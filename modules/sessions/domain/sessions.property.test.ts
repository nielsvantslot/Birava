import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { DrinkEntry } from "@/lib/types";
import { SESSION_GAP_MS, groupIntoSessions } from "./sessions";

const HOUR = 60 * 60 * 1000;
const BASE = Date.parse("2026-03-01T00:00:00.000Z");

type EntrySpec = { user: string; quarterHours: number };

/**
 * Quarter-hour offsets across ~2 days put plenty of gaps right on the 4h
 * boundary (exactly 4h is *inside* a session, 4h15m is not), which is where
 * the grouping rule can go wrong.
 */
const entrySpecs = fc.array(
  fc.record({
    user: fc.constantFrom("alice", "bob", "carol"),
    quarterHours: fc.integer({ min: 0, max: 8 * 24 }),
  }),
  { maxLength: 40 }
);

function toEntries(specs: EntrySpec[]): DrinkEntry[] {
  return specs.map((s, i) => ({
    id: `e${i}`,
    user_id: s.user,
    session_id: `s${i}`,
    drink_name: null,
    drink_type: "Beer",
    venue: null,
    lat: null,
    lng: null,
    photo_url: null,
    photo_lqip: null,
    created_at: new Date(BASE + s.quarterHours * 15 * 60 * 1000).toISOString(),
  }));
}

const time = (e: DrinkEntry) => Date.parse(e.created_at);

/** Deterministic Fisher-Yates shuffle (mulberry32), so a failing seed replays. */
function shuffle<T>(list: T[], seed: number): T[] {
  const out = [...list];
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

describe("groupIntoSessions properties", () => {
  it("puts every check-in in exactly one session, within a single user", () => {
    fc.assert(
      fc.property(entrySpecs, (specs) => {
        const entries = toEntries(specs);
        const sessions = groupIntoSessions(entries);
        const ids = sessions.flatMap((s) => s.checkins.map((c) => c.id));
        expect([...ids].sort()).toEqual(entries.map((e) => e.id).sort());
        for (const s of sessions) {
          expect(new Set(s.checkins.map((c) => c.user_id)).size).toBe(1);
        }
      })
    );
  });

  it("splits on a gap strictly longer than 4 hours, and only then", () => {
    fc.assert(
      fc.property(entrySpecs, (specs) => {
        const sessions = groupIntoSessions(toEntries(specs));
        for (const s of sessions) {
          const times = s.checkins.map(time).sort((a, b) => a - b);
          for (let i = 1; i < times.length; i++) {
            expect(times[i]! - times[i - 1]!).toBeLessThanOrEqual(SESSION_GAP_MS);
          }
        }
        // Between two sessions of the same user the gap is strictly longer.
        const perUser = new Map<string, typeof sessions>();
        for (const s of sessions) perUser.set(s.userId, [...(perUser.get(s.userId) ?? []), s]);
        for (const own of perUser.values()) {
          const ordered = [...own].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
          for (let i = 1; i < ordered.length; i++) {
            const gap = Date.parse(ordered[i]!.start) - Date.parse(ordered[i - 1]!.end);
            expect(gap).toBeGreaterThan(SESSION_GAP_MS);
          }
        }
      })
    );
  });

  it("does not depend on the order check-ins arrive in", () => {
    fc.assert(
      fc.property(entrySpecs, fc.integer(), (specs, seed) => {
        const entries = toEntries(specs);
        const shuffled = shuffle(entries, seed);
        const partition = (list: DrinkEntry[]) =>
          groupIntoSessions(list)
            .map((s) => s.checkins.map((c) => c.id).sort().join(","))
            .sort();
        expect(partition(shuffled)).toEqual(partition(entries));
      })
    );
  });

  it("derives a session's bounds from its first and last check-in", () => {
    fc.assert(
      fc.property(entrySpecs, (specs) => {
        for (const s of groupIntoSessions(toEntries(specs))) {
          const times = s.checkins.map(time);
          expect(Date.parse(s.start)).toBe(Math.min(...times));
          expect(Date.parse(s.end)).toBe(Math.max(...times));
        }
      })
    );
  });

  it("is idempotent: regrouping a session's own check-ins yields that one session", () => {
    fc.assert(
      fc.property(entrySpecs, (specs) => {
        for (const s of groupIntoSessions(toEntries(specs))) {
          const again = groupIntoSessions(s.checkins);
          expect(again).toHaveLength(1);
          expect(again[0]!.checkins.map((c) => c.id).sort()).toEqual(s.checkins.map((c) => c.id).sort());
        }
      })
    );
  });

  it("treats a gap of exactly 4 hours as the same session", () => {
    const entries = toEntries([
      { user: "alice", quarterHours: 0 },
      { user: "alice", quarterHours: (4 * HOUR) / (15 * 60 * 1000) },
    ]);
    expect(groupIntoSessions(entries)).toHaveLength(1);
  });
});
