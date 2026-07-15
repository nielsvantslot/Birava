import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createDrinkEntry, deleteDrinkEntry } from "@/lib/commands/drinkEntryCommands";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";

const fixtures = new DrinkEntryFixtureFactory(db);

const emptyPayload = {
  drinkName: null,
  drinkType: "Beer",
  venue: null,
  lat: null,
  lng: null,
  notes: null,
  photoUrl: null,
  photoLqip: null,
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function createAt(
  userId: string,
  actor: { username: string; avatarUrl: string | null },
  createdAt: number
) {
  const result = await createDrinkEntry(userId, { ...emptyPayload, createdAt }, actor);
  if (result.error) throw new Error(result.error);
  return db.drinkEntry.findUniqueOrThrow({ where: { id: result.id! } });
}

describe("createDrinkEntry session placement", () => {
  it("attaches to the prior session when within the 4h gap", async () => {
    const user = await fixtures.createUser();
    const actor = { username: user.username, avatarUrl: user.avatarUrl };
    const base = Date.now() - 2 * DAY;

    const a = await createAt(user.id, actor, base);
    const b = await createAt(user.id, actor, base + HOUR);

    expect(b.sessionId).toBe(a.sessionId);
    const session = await db.drinkSession.findUniqueOrThrow({ where: { id: a.sessionId } });
    expect(session.endedAt.getTime()).toBe(b.createdAt.getTime());
  });

  it("attaches to the following session when backdated just before it", async () => {
    const user = await fixtures.createUser();
    const actor = { username: user.username, avatarUrl: user.avatarUrl };
    const base = Date.now() - 2 * DAY;

    const a = await createAt(user.id, actor, base);
    const b = await createAt(user.id, actor, base - HOUR); // backdated, earlier than a

    expect(b.sessionId).toBe(a.sessionId); // id stays put — permanent once created
    const session = await db.drinkSession.findUniqueOrThrow({ where: { id: a.sessionId } });
    expect(session.startedAt.getTime()).toBe(b.createdAt.getTime());
  });

  it("starts a new session when outside the gap on both sides", async () => {
    const user = await fixtures.createUser();
    const actor = { username: user.username, avatarUrl: user.avatarUrl };
    const base = Date.now() - 2 * DAY;

    const a = await createAt(user.id, actor, base);
    const c = await createAt(user.id, actor, base + 8 * HOUR);

    expect(c.sessionId).not.toBe(a.sessionId);
    expect(c.sessionId).toBe(c.id);
  });

  it("merges two sessions when a backdated check-in bridges the gap", async () => {
    const user = await fixtures.createUser();
    const actor = { username: user.username, avatarUrl: user.avatarUrl };
    const base = Date.now() - 2 * DAY;

    const a = await createAt(user.id, actor, base);
    const c = await createAt(user.id, actor, base + 8 * HOUR);
    expect(c.sessionId).not.toBe(a.sessionId);
    const originalLoserSessionId = c.sessionId;

    const bridging = await createAt(user.id, actor, base + 4 * HOUR); // 4h from both

    const survivorId = a.sessionId;
    const [aAfter, bridgingAfter, cAfter] = await Promise.all([
      db.drinkEntry.findUniqueOrThrow({ where: { id: a.id } }),
      db.drinkEntry.findUniqueOrThrow({ where: { id: bridging.id } }),
      db.drinkEntry.findUniqueOrThrow({ where: { id: c.id } }),
    ]);
    expect(aAfter.sessionId).toBe(survivorId);
    expect(bridgingAfter.sessionId).toBe(survivorId);
    expect(cAfter.sessionId).toBe(survivorId);

    const loserSession = await db.drinkSession.findUnique({ where: { id: originalLoserSessionId } });
    expect(loserSession).toBeNull();

    const survivor = await db.drinkSession.findUniqueOrThrow({ where: { id: survivorId } });
    expect(survivor.startedAt.getTime()).toBe(aAfter.createdAt.getTime());
    expect(survivor.endedAt.getTime()).toBe(cAfter.createdAt.getTime());
  });
});

describe("createDrinkEntry backdating trust window", () => {
  it("clamps createdAt beyond MAX_BACKDATE_MS to now", async () => {
    const user = await fixtures.createUser();
    const actor = { username: user.username, avatarUrl: user.avatarUrl };
    const tooOld = Date.now() - 10 * DAY;

    const before = Date.now();
    const entry = await createAt(user.id, actor, tooOld);
    const after = Date.now();

    expect(entry.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(entry.createdAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("accepts createdAt within the trust window", async () => {
    const user = await fixtures.createUser();
    const actor = { username: user.username, avatarUrl: user.avatarUrl };
    const withinWindow = Date.now() - 3 * DAY;

    const entry = await createAt(user.id, actor, withinWindow);
    expect(entry.createdAt.getTime()).toBe(withinWindow);
  });
});

describe("deleteDrinkEntry session recomputation", () => {
  it("deletes the session row when its only entry is removed", async () => {
    const owner = await fixtures.createUser();
    const entry = await fixtures.createDrinkEntry(owner.id);
    const sessionId = (await db.drinkEntry.findUniqueOrThrow({ where: { id: entry.id } })).sessionId;

    await deleteDrinkEntry(owner.id, { id: entry.id });

    const session = await db.drinkSession.findUnique({ where: { id: sessionId } });
    expect(session).toBeNull();
  });

  it("splits a session when removing a bridging entry exposes a >4h gap", async () => {
    const owner = await fixtures.createUser();
    const base = Date.now() - 2 * DAY;

    const a = await fixtures.createDrinkEntry(owner.id, { createdAt: new Date(base) });
    const sharedSessionId = (await db.drinkEntry.findUniqueOrThrow({ where: { id: a.id } })).sessionId;
    const b = await fixtures.createDrinkEntry(owner.id, {
      createdAt: new Date(base + 3 * HOUR),
      sessionId: sharedSessionId,
    });
    const c = await fixtures.createDrinkEntry(owner.id, {
      createdAt: new Date(base + 6 * HOUR),
      sessionId: sharedSessionId,
    });

    await deleteDrinkEntry(owner.id, { id: b.id });

    const [aAfter, cAfter] = await Promise.all([
      db.drinkEntry.findUniqueOrThrow({ where: { id: a.id } }),
      db.drinkEntry.findUniqueOrThrow({ where: { id: c.id } }),
    ]);

    expect(aAfter.sessionId).toBe(sharedSessionId);
    expect(cAfter.sessionId).not.toBe(sharedSessionId);
    expect(cAfter.sessionId).toBe(c.id);

    const originalSession = await db.drinkSession.findUniqueOrThrow({ where: { id: sharedSessionId } });
    expect(originalSession.startedAt.getTime()).toBe(aAfter.createdAt.getTime());
    expect(originalSession.endedAt.getTime()).toBe(aAfter.createdAt.getTime());

    const newSession = await db.drinkSession.findUniqueOrThrow({ where: { id: cAfter.sessionId } });
    expect(newSession.startedAt.getTime()).toBe(cAfter.createdAt.getTime());
    expect(newSession.endedAt.getTime()).toBe(cAfter.createdAt.getTime());
  });
});
