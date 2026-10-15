import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createDrinkEntry, deleteDrinkEntry } from "@/modules/checkins/application/drinkEntryCommands";
import { groupIntoSessions, SESSION_GAP_MS } from "@/modules/sessions/domain/sessions";
import { toDrinkEntry } from "@/lib/mappers";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";

const fixtures = new DrinkEntryFixtureFactory(db);

const QUARTER_HOUR = 15 * 60 * 1000;
const emptyPayload = {
  drinkName: null,
  drinkType: "Beer" as const,
  venue: null,
  lat: null,
  lng: null,
  photoUrl: null,
  photoLqip: null,
};

/**
 * Quarter-hour offsets across ~2 days: gaps land on, just under and just over
 * the 4h boundary, so bridging, extending and splitting all get exercised.
 * Everything sits inside the 7-day backdate trust window.
 */
type Op = { kind: "create"; quarterHours: number } | { kind: "delete"; pick: number };

const ops = fc.array(
  fc.oneof(
    { weight: 3, arbitrary: fc.record({ kind: fc.constant("create" as const), quarterHours: fc.integer({ min: 0, max: 8 * 24 }) }) },
    { weight: 1, arbitrary: fc.record({ kind: fc.constant("delete" as const), pick: fc.nat() }) }
  ),
  { minLength: 1, maxLength: 14 }
);

async function sessionsFor(userId: string) {
  const [sessions, entries] = await Promise.all([
    db.drinkSession.findMany({ where: { userId } }),
    db.drinkEntry.findMany({ where: { userId }, include: { venue: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return { sessions, entries };
}

/** Stored sessions as sets of check-in ids, so ids and row order don't matter. */
function partitionFromStore(entries: { id: string; sessionId: string }[]): string[] {
  const byId = new Map<string, string[]>();
  for (const e of entries) byId.set(e.sessionId, [...(byId.get(e.sessionId) ?? []), e.id]);
  return [...byId.values()].map((ids) => ids.sort().join(",")).sort();
}

describe("session maintenance properties", () => {
  it("keeps stored sessions equal to a from-scratch recomputation after any sequence of creates and deletes", async () => {
    await fc.assert(
      fc.asyncProperty(ops, async (sequence: Op[]) => {
        const user = await fixtures.createUser();
        const actor = { username: user.username, avatarUrl: user.avatarUrl };
        const base = Date.now() - 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000;
        const live: string[] = [];
        let deleted: string | null = null;

        for (const op of sequence) {
          const before = await sessionsFor(user.id);
          const beforeIds = new Set(before.sessions.map((s) => s.id));

          deleted = null;
          if (op.kind === "create") {
            const result = await createDrinkEntry(user.id, { ...emptyPayload, createdAt: base + op.quarterHours * QUARTER_HOUR }, actor);
            expect(result.error).toBeUndefined();
            live.push(result.id!);
          } else if (live.length > 0) {
            const victim = live.splice(op.pick % live.length, 1)[0]!;
            deleted = victim;
            const result = await deleteDrinkEntry(user.id, { id: victim });
            expect(result.error).toBeUndefined();
          }

          const { sessions, entries } = await sessionsFor(user.id);

          // 1. Same partition as recomputing from the raw check-ins.
          const recomputed = groupIntoSessions(entries.map(toDrinkEntry))
            .map((s) => s.checkins.map((c) => c.id).sort().join(","))
            .sort();
          expect(partitionFromStore(entries)).toEqual(recomputed);

          // 2. One stored row per session, no orphans, and bounds are the first/last check-in.
          expect(sessions).toHaveLength(recomputed.length);
          for (const s of sessions) {
            const own = entries.filter((e) => e.sessionId === s.id);
            expect(own.length).toBeGreaterThan(0);
            expect(s.startedAt.getTime()).toBe(Math.min(...own.map((e) => e.createdAt.getTime())));
            expect(s.endedAt.getTime()).toBe(Math.max(...own.map((e) => e.createdAt.getTime())));
            for (let i = 1; i < own.length; i++) {
              expect(own[i]!.createdAt.getTime() - own[i - 1]!.createdAt.getTime()).toBeLessThanOrEqual(SESSION_GAP_MS);
            }
          }

          // 3. Ids are permanent: a session that still has check-ins keeps its id. Only a
          //    merge's absorbed session (on create) or an emptied one (on delete) may vanish.
          const afterIds = new Set(sessions.map((s) => s.id));
          const vanished = [...beforeIds].filter((id) => !afterIds.has(id));
          expect(vanished.length).toBeLessThanOrEqual(1);
          if (deleted !== null) {
            for (const id of vanished) {
              const formerMembers = before.entries.filter((e) => e.sessionId === id).map((e) => e.id);
              expect(formerMembers).toEqual([deleted]);
            }
          }
        }
      }),
      { numRuns: 30 }
    );
  }, 120_000);

  it("never changes an existing session's id when a check-in joins or extends it", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -40, max: 40 }), async (offsetQuarterHours) => {
        const user = await fixtures.createUser();
        const actor = { username: user.username, avatarUrl: user.avatarUrl };
        const anchorAt = Date.now() - 3 * 24 * 60 * 60 * 1000;

        const anchor = await createDrinkEntry(user.id, { ...emptyPayload, createdAt: anchorAt }, actor);
        const second = await createDrinkEntry(user.id, { ...emptyPayload, createdAt: anchorAt + offsetQuarterHours * QUARTER_HOUR }, actor);

        const anchorRow = await db.drinkEntry.findUniqueOrThrow({ where: { id: anchor.id! } });
        const secondRow = await db.drinkEntry.findUniqueOrThrow({ where: { id: second.id! } });
        // The anchor's session id was minted from the anchor itself and never moves...
        expect(anchorRow.sessionId).toBe(anchor.id);
        // ...whether the new check-in landed in it (within 4h, before or after) or started its own.
        const joined = Math.abs(offsetQuarterHours * QUARTER_HOUR) <= SESSION_GAP_MS;
        expect(secondRow.sessionId === anchorRow.sessionId).toBe(joined);
      }),
      { numRuns: 25 }
    );
  }, 120_000);
});
