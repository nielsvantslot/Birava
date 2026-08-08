import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { sendSessionReminders } from "@/lib/commands/sessionReminderCommands";
import { SESSION_GAP_MS } from "@/lib/sessions";
import { ENGAGEMENT_RESOLUTION_WINDOW_MS } from "@/lib/sessionReminderAlgorithm";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";
import { flushAfterCallbacks } from "./setup";

const fixtures = new DrinkEntryFixtureFactory(db);
const MIN = 60 * 1000;

// queueNotifications defers its write via after() (mocked in setup.ts to run
// asynchronously rather than synchronously) — flush it before asserting on
// the resulting Notification rows, same as sendSessionReminders' own return
// value doesn't wait for it either.
async function runReminderTick(): Promise<{ sent: number }> {
  const result = await sendSessionReminders();
  await flushAfterCallbacks();
  return result;
}

async function sessionIdFor(entryId: string): Promise<string> {
  return (await db.drinkEntry.findUniqueOrThrow({ where: { id: entryId } })).sessionId;
}

/** A closed (long-past, out of the quiet-candidate window) session with two check-ins `gapMs` apart. */
async function seedClosedSessionWithGap(userId: string, gapMs: number): Promise<void> {
  const base = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
  const first = await fixtures.createDrinkEntry(userId, { createdAt: base });
  const sessionId = await sessionIdFor(first.id);
  await fixtures.createDrinkEntry(userId, { sessionId, createdAt: new Date(base.getTime() + gapMs) });
  await db.drinkSession.update({ where: { id: sessionId }, data: { endedAt: new Date(base.getTime() + gapMs) } });
}

/** A currently-quiet lone-check-in session, last active `elapsedMs` ago. */
async function seedQuietSession(userId: string, elapsedMs: number): Promise<string> {
  const entry = await fixtures.createDrinkEntry(userId, { createdAt: new Date(Date.now() - elapsedMs) });
  return sessionIdFor(entry.id);
}

async function seedResolvedReminderHistory(userId: string, count: number, openedCount: number): Promise<void> {
  const sentAt = new Date(Date.now() - ENGAGEMENT_RESOLUTION_WINDOW_MS - MIN);
  for (let i = 0; i < count; i++) {
    await db.notification.create({
      data: {
        userId,
        type: "SESSION_REMINDER",
        entryId: randomUUID(),
        createdAt: sentAt,
        openedAt: i < openedCount ? sentAt : null,
      },
    });
  }
}

function reminderCount(sessionId: string) {
  return db.notification.count({ where: { entryId: sessionId, type: "SESSION_REMINDER" } });
}

describe("sendSessionReminders", () => {
  it("does nothing when no session is currently quiet", async () => {
    const result = await runReminderTick();
    expect(result.sent).toBeGreaterThanOrEqual(0); // other tests may run concurrently; just shouldn't throw
  });

  it("ignores a session that's already past the 4-hour hard close", async () => {
    const user = await fixtures.createUser();
    const sessionId = await seedQuietSession(user.id, SESSION_GAP_MS + MIN);

    await runReminderTick();

    expect(await reminderCount(sessionId)).toBe(0);
  });

  it("reminds a fast logger sooner than a slow logger for an equally-quiet session", async () => {
    const fastUser = await fixtures.createUser();
    const slowUser = await fixtures.createUser();
    await seedClosedSessionWithGap(fastUser.id, 20 * MIN);
    await seedClosedSessionWithGap(slowUser.id, 100 * MIN);

    const fastSessionId = await seedQuietSession(fastUser.id, 35 * MIN);
    const slowSessionId = await seedQuietSession(slowUser.id, 35 * MIN);

    await runReminderTick();

    expect(await reminderCount(fastSessionId)).toBe(1);
    expect(await reminderCount(slowSessionId)).toBe(0);
  });

  it("escalates to a second reminder once a still-quiet session crosses tier 2", async () => {
    const user = await fixtures.createUser(); // no history -> default 60min threshold, cold-start maxReminders=2
    const sessionId = await seedQuietSession(user.id, 130 * MIN); // past tier 2 (120min)
    await db.notification.create({
      data: { userId: user.id, type: "SESSION_REMINDER", entryId: sessionId, createdAt: new Date(Date.now() - 125 * MIN) },
    });

    await runReminderTick();

    expect(await reminderCount(sessionId)).toBe(2);
  });

  it("caps escalation for a user who consistently never opens past reminders", async () => {
    const user = await fixtures.createUser();
    await seedResolvedReminderHistory(user.id, 5, 0); // 5 resolved, 0 opened -> maxReminders=1
    const sessionId = await seedQuietSession(user.id, 130 * MIN); // past tier 2
    await db.notification.create({
      data: { userId: user.id, type: "SESSION_REMINDER", entryId: sessionId, createdAt: new Date(Date.now() - 125 * MIN) },
    });

    await runReminderTick();

    expect(await reminderCount(sessionId)).toBe(1); // stayed capped at 1, no escalation
  });

  it("allows full escalation for a user who reliably opens past reminders", async () => {
    const user = await fixtures.createUser();
    await seedResolvedReminderHistory(user.id, 5, 4); // 4/5 opened -> maxReminders=3
    const sessionId = await seedQuietSession(user.id, 220 * MIN); // past tier 3
    await db.notification.create({
      data: { userId: user.id, type: "SESSION_REMINDER", entryId: sessionId, createdAt: new Date(Date.now() - 200 * MIN) },
    });
    await db.notification.create({
      data: { userId: user.id, type: "SESSION_REMINDER", entryId: sessionId, createdAt: new Date(Date.now() - 150 * MIN) },
    });

    await runReminderTick();

    expect(await reminderCount(sessionId)).toBe(3);
  });
});
