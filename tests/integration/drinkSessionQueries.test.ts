import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createDrinkEntry } from "@/lib/commands/drinkEntryCommands";
import { getSessionById, getSessionsForUserIds } from "@/lib/queries/drinkSessionQueries";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function createAt(
  userId: string,
  actor: { username: string; avatarUrl: string | null },
  createdAt: number,
  overrides: Partial<{ venue: string | null; drinkType: string; photoUrl: string | null }> = {}
) {
  const base = { drinkName: "Tripel", drinkType: "Beer", venue: "Café Gollem", lat: null, lng: null, notes: null, photoUrl: null, photoLqip: null };
  const result = await createDrinkEntry(userId, { ...base, ...overrides, createdAt }, actor);
  if (result.error) throw new Error(result.error);
  return db.drinkEntry.findUniqueOrThrow({ where: { id: result.id! } });
}

describe("getSessionById", () => {
  it("assembles venues/types/photoIds/checkins from the real session row", async () => {
    const user = await db.user.create({
      data: { username: "session_query_user", email: "session_query_user@test.birava", passwordHash: "x" },
    });
    const actor = { username: user.username, avatarUrl: user.avatarUrl };
    const base = Date.now() - DAY;

    const a = await createAt(user.id, actor, base, { photoUrl: "photo.webp" });
    const b = await createAt(user.id, actor, base + HOUR, { venue: "The Local Taphouse", drinkType: "Wine" });
    expect(b.sessionId).toBe(a.sessionId);

    const session = await getSessionById(b.sessionId);
    expect(session).not.toBeNull();
    expect(session!.checkins).toHaveLength(2);
    expect(session!.venues).toEqual(["Café Gollem", "The Local Taphouse"]);
    expect(session!.types).toEqual(["Beer", "Wine"]);
    expect(session!.photoIds).toEqual([a.id]);
    expect(session!.username).toBe(user.username);
  });

  it("keeps the session's permanent id even when a backdated attach makes another entry chronologically first", async () => {
    const user = await db.user.create({
      data: { username: "permanent_id_user", email: "permanent_id_user@test.birava", passwordHash: "x" },
    });
    const actor = { username: user.username, avatarUrl: user.avatarUrl };
    const base = Date.now() - 2 * DAY;

    const a = await createAt(user.id, actor, base);
    const earlier = await createAt(user.id, actor, base - HOUR);

    expect(earlier.sessionId).toBe(a.sessionId);
    expect(earlier.sessionId).not.toBe(earlier.id);

    const session = await getSessionById(a.sessionId);
    expect(session).not.toBeNull();
    expect(session!.id).toBe(a.sessionId);
    expect(session!.checkins[0].id).toBe(earlier.id);
    expect(session!.checkins[0].id).not.toBe(session!.id);
  });

  it("returns null for an id that isn't a real session", async () => {
    expect(await getSessionById("00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await getSessionById("not-a-uuid")).toBeNull();
  });
});

describe("getSessionsForUserIds", () => {
  it("orders newest-ended first and respects the limit", async () => {
    const user = await db.user.create({
      data: { username: "feed_query_user", email: "feed_query_user@test.birava", passwordHash: "x" },
    });
    const actor = { username: user.username, avatarUrl: user.avatarUrl };
    const base = Date.now() - 3 * DAY;

    const first = await createAt(user.id, actor, base);
    const second = await createAt(user.id, actor, base + 8 * HOUR);
    const third = await createAt(user.id, actor, base + 16 * HOUR);

    const page = await getSessionsForUserIds([user.id], { limit: 2 });
    expect(page).toHaveLength(2);
    expect(page[0].id).toBe(third.sessionId);
    expect(page[1].id).toBe(second.sessionId);
    expect(page.some((s) => s.id === first.sessionId)).toBe(false);
  });

  it("returns an empty array for no user ids", async () => {
    expect(await getSessionsForUserIds([])).toEqual([]);
  });

  it("fetches the next page via a keyset cursor with no overlap or gaps", async () => {
    const user = await db.user.create({
      data: { username: "cursor_query_user", email: "cursor_query_user@test.birava", passwordHash: "x" },
    });
    const actor = { username: user.username, avatarUrl: user.avatarUrl };
    const base = Date.now() - 4 * DAY;

    const a = await createAt(user.id, actor, base);
    const b = await createAt(user.id, actor, base + 8 * HOUR);
    const c = await createAt(user.id, actor, base + 16 * HOUR);
    const d = await createAt(user.id, actor, base + 24 * HOUR);

    const page1 = await getSessionsForUserIds([user.id], { limit: 2 });
    expect(page1.map((s) => s.id)).toEqual([d.sessionId, c.sessionId]);

    const lastOfPage1 = page1[page1.length - 1];
    const page2 = await getSessionsForUserIds([user.id], {
      limit: 2,
      before: { endedAt: new Date(lastOfPage1.end), id: lastOfPage1.id },
    });
    expect(page2.map((s) => s.id)).toEqual([b.sessionId, a.sessionId]);
  });

  it("keyset pagination is immune to a session created between page fetches (unlike offset-based skip)", async () => {
    const user = await db.user.create({
      data: { username: "concurrent_insert_user", email: "concurrent_insert_user@test.birava", passwordHash: "x" },
    });
    const actor = { username: user.username, avatarUrl: user.avatarUrl };
    const base = Date.now() - 4 * DAY;

    const a = await createAt(user.id, actor, base);
    const b = await createAt(user.id, actor, base + 8 * HOUR);
    const c = await createAt(user.id, actor, base + 16 * HOUR);
    const d = await createAt(user.id, actor, base + 24 * HOUR);

    const page1 = await getSessionsForUserIds([user.id], { limit: 2 });
    expect(page1.map((s) => s.id)).toEqual([d.sessionId, c.sessionId]);
    const lastOfPage1 = page1[page1.length - 1];

    // A new check-in arrives after page 1 was fetched but before page 2 is —
    // newer than everything above, so it should never appear on any page
    // fetched relative to a cursor older than it.
    const e = await createAt(user.id, actor, base + 32 * HOUR);

    const page2 = await getSessionsForUserIds([user.id], {
      limit: 2,
      before: { endedAt: new Date(lastOfPage1.end), id: lastOfPage1.id },
    });
    expect(page2.map((s) => s.id)).toEqual([b.sessionId, a.sessionId]);
    expect(page2.some((s) => s.id === e.sessionId)).toBe(false);
    expect(page2.some((s) => s.id === d.sessionId || s.id === c.sessionId)).toBe(false);
  });
});
