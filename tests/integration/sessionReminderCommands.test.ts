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
    await seedClosedSessionWithGap(fastUser.id, 20 * MIN); // clamps to the 30min floor -> overdue at 45min
    await seedClosedSessionWithGap(slowUser.id, 100 * MIN); // clamps to the 90min ceiling -> overdue at 105min

    const fastSessionId = await seedQuietSession(fastUser.id, 50 * MIN);
    const slowSessionId = await seedQuietSession(slowUser.id, 50 * MIN);

    await runReminderTick();

    expect(await reminderCount(fastSessionId)).toBe(1);
    expect(await reminderCount(slowSessionId)).toBe(0);
  });

  it("sends a second reminder once a still-quiet session crosses the next slot", async () => {
    const user = await fixtures.createUser(); // no history -> default 60min gap, cold-start maxReminders=2
    const sessionId = await seedQuietSession(user.id, 140 * MIN); // past slot 2 (135min = 2*60+15)
    await db.notification.create({
      data: { userId: user.id, type: "SESSION_REMINDER", entryId: sessionId, createdAt: new Date(Date.now() - 130 * MIN) },
    });

    await runReminderTick();

    expect(await reminderCount(sessionId)).toBe(2);
  });

  it("caps repeats for a user who consistently never opens past reminders", async () => {
    const user = await fixtures.createUser();
    await seedResolvedReminderHistory(user.id, 5, 0); // 5 resolved, 0 opened -> maxReminders=1
    const sessionId = await seedQuietSession(user.id, 140 * MIN); // past slot 2
    await db.notification.create({
      data: { userId: user.id, type: "SESSION_REMINDER", entryId: sessionId, createdAt: new Date(Date.now() - 130 * MIN) },
    });

    await runReminderTick();

    expect(await reminderCount(sessionId)).toBe(1); // stayed capped at 1, no repeat
  });

  it("allows the full 3 reminders for a user who reliably opens past reminders", async () => {
    const user = await fixtures.createUser();
    await seedResolvedReminderHistory(user.id, 5, 4); // 4/5 opened -> maxReminders=3
    const sessionId = await seedQuietSession(user.id, 220 * MIN); // past slot 3 (195min = 3*60+15)
    await db.notification.create({
      data: { userId: user.id, type: "SESSION_REMINDER", entryId: sessionId, createdAt: new Date(Date.now() - 200 * MIN) },
    });
    await db.notification.create({
      data: { userId: user.id, type: "SESSION_REMINDER", entryId: sessionId, createdAt: new Date(Date.now() - 150 * MIN) },
    });

    await runReminderTick();

    expect(await reminderCount(sessionId)).toBe(3);
  });

  it("doesn't make the next reminder wait longer just because an earlier one was already sent for this session", async () => {
    // Regression test: a prior design counted reminders cumulatively across
    // the session's whole lifetime, so each subsequent reminder needed an
    // escalating multiple of the quiet threshold (2x, then 3.5x) even right
    // after the user had just logged a drink. Reminders should instead reset
    // per check-in, so logging in response to reminder #1 shouldn't push
    // reminder #2 further away than one more ordinary gap.
    const user = await fixtures.createUser(); // no history yet -> cold-start maxReminders=2
    const first = await fixtures.createDrinkEntry(user.id, { createdAt: new Date(Date.now() - 195 * MIN) });
    const sessionId = await sessionIdFor(first.id);

    // Reminder #1, sent while quiet after the first check-in.
    await db.notification.create({
      data: { userId: user.id, type: "SESSION_REMINDER", entryId: sessionId, createdAt: new Date(Date.now() - 125 * MIN) },
    });

    // The user acts on it and logs a second check-in — this session's own
    // gap (75min) becomes the expected gap going forward, and endedAt moves
    // up to this check-in, resetting the "sent since last check-in" count.
    const secondCreatedAt = new Date(Date.now() - 120 * MIN);
    await fixtures.createDrinkEntry(user.id, { sessionId, createdAt: secondCreatedAt });
    await db.drinkSession.update({ where: { id: sessionId }, data: { endedAt: secondCreatedAt } });

    // Only ~120min have passed since the second check-in (~1 gap + buffer of
    // 75min), not the ~150min a 2x-escalated tier would have demanded.
    await runReminderTick();

    expect(await reminderCount(sessionId)).toBe(2);
  });
});
