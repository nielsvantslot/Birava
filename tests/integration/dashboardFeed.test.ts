import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createDrinkEntry } from "@/lib/commands/drinkEntryCommands";
import { getMyFeedSessions } from "@/lib/controllers/drinkController";
import { loginAs } from "./support/loginAs";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const GAP = 8 * HOUR; // > SESSION_GAP_MS, so each check-in starts its own session
const FEED_PAGE_SIZE = 12; // matches drinkController.ts's FEED_SESSION_LIMIT

async function createSessionsFor(userId: string, count: number, base: number) {
  const actor = { username: "unused", avatarUrl: null };
  const payload = { drinkName: null, drinkType: "Beer", venue: null, lat: null, lng: null, notes: null, photoUrl: null, photoLqip: null };
  const created = [];
  for (let i = 0; i < count; i++) {
    const result = await createDrinkEntry(userId, { ...payload, createdAt: base + i * GAP }, actor);
    if (result.error) throw new Error(result.error);
    created.push(await db.drinkEntry.findUniqueOrThrow({ where: { id: result.id! } }));
  }
  return created;
}

describe("getMyFeedSessions", () => {
  it("returns an empty page when nobody is logged in", async () => {
    const page = await getMyFeedSessions({ onlyOwn: true });
    expect(page).toEqual({ sessions: [], cheers: [], commentCounts: [], nextCursor: null });
  });

  it("paginates the viewer's own sessions across two pages via the cursor", async () => {
    const user = await db.user.create({
      data: { username: "feed_page_user", email: "feed_page_user@test.birava", passwordHash: "x" },
    });
    await loginAs(user.id);

    // Within MAX_BACKDATE_MS's 7-day trust window (lib/sessions.ts) — anything
    // older gets silently clamped to now() by createDrinkEntry, which would
    // collapse every one of these into a single same-instant session instead
    // of FEED_PAGE_SIZE + 1 distinct ones.
    const base = Date.now() - 6 * DAY;
    const entries = await createSessionsFor(user.id, FEED_PAGE_SIZE + 1, base);

    const page1 = await getMyFeedSessions({ onlyOwn: true });
    expect(page1.sessions).toHaveLength(FEED_PAGE_SIZE);
    expect(page1.nextCursor).not.toBeNull();
    // Newest-ended first: page 1 is the last FEED_PAGE_SIZE entries created.
    const expectedPage1Ids = entries
      .slice(1)
      .map((e) => e.sessionId)
      .reverse();
    expect(page1.sessions.map((s) => s.id)).toEqual(expectedPage1Ids);

    const page2 = await getMyFeedSessions({
      onlyOwn: true,
      beforeEndedAt: page1.nextCursor!.endedAt,
      beforeId: page1.nextCursor!.id,
    });
    expect(page2.sessions).toHaveLength(1);
    expect(page2.sessions[0].id).toBe(entries[0].sessionId);
    expect(page2.nextCursor).toBeNull();
  });

  it("includes a followed user's sessions on the Following tab, and excludes them on the You tab", async () => {
    const viewer = await db.user.create({
      data: { username: "feed_viewer", email: "feed_viewer@test.birava", passwordHash: "x" },
    });
    const followed = await db.user.create({
      data: { username: "feed_followed", email: "feed_followed@test.birava", passwordHash: "x" },
    });
    await db.follow.create({ data: { followerId: viewer.id, followingId: followed.id } });
    await loginAs(viewer.id);

    const base = Date.now() - DAY;
    const [ownEntry] = await createSessionsFor(viewer.id, 1, base);
    const [followedEntry] = await createSessionsFor(followed.id, 1, base + GAP);

    const following = await getMyFeedSessions({ onlyOwn: false });
    expect(following.sessions.map((s) => s.id).sort()).toEqual(
      [ownEntry.sessionId, followedEntry.sessionId].sort()
    );

    const onlyOwn = await getMyFeedSessions({ onlyOwn: true });
    expect(onlyOwn.sessions.map((s) => s.id)).toEqual([ownEntry.sessionId]);
  });

  it("bundles cheer state and comment counts for the viewer", async () => {
    const owner = await db.user.create({
      data: { username: "feed_cheer_owner", email: "feed_cheer_owner@test.birava", passwordHash: "x" },
    });
    const [entry] = await createSessionsFor(owner.id, 1, Date.now() - DAY);

    await db.cheer.create({ data: { sessionId: entry.sessionId, userId: owner.id } });
    await db.comment.createMany({
      data: [
        { sessionId: entry.sessionId, userId: owner.id, body: "nice" },
        { sessionId: entry.sessionId, userId: owner.id, body: "again" },
      ],
    });

    await loginAs(owner.id);
    const page = await getMyFeedSessions({ onlyOwn: true });

    const cheerEntry = page.cheers.find(([id]) => id === entry.sessionId);
    expect(cheerEntry?.[1]).toEqual({ count: 1, on: true });
    const commentEntry = page.commentCounts.find(([id]) => id === entry.sessionId);
    expect(commentEntry?.[1]).toBe(2);
  });
});
