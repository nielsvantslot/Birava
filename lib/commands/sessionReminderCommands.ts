import { db } from "@/lib/db";
import { queueNotifications, type NotificationEvent } from "@/lib/notify";
import { SESSION_GAP_MS } from "@/lib/sessions";
import { RateLimiterFactory } from "@/lib/rateLimit/RateLimiterFactory";
import {
  getIntraSessionGapsBySessionId,
  getIntraSessionGapsForUser,
  getReminderEngagementForUser,
} from "@/lib/queries/reminderAlgorithmQueries";
import { dueSlotsForElapsed, expectedGapMs, maxRemindersForEngagement } from "@/lib/sessionReminderAlgorithm";

const REMINDER_TICK_KEY = "session-reminders-tick";
const REMINDER_TICK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Reminds the owner of each still-open-but-quiet session to log their next
 * drink — a logging-completeness nudge, not a "keep drinking" prompt (see
 * lib/notifications.ts's SESSION_REMINDER copy). Meant to be called
 * periodically (app/api/cron/session-reminders/route.ts).
 *
 * Three things make this per-user rather than one global rule
 * (lib/sessionReminderAlgorithm.ts has the pure math):
 *  - Personalized timing: "gone quiet" is measured against this session's own
 *    check-in gaps so far (tonight's actual pace), falling back to the
 *    user's historical median, instead of a fixed 1h for everyone.
 *  - Consistent-cadence repeats: once overdue, reminders repeat every
 *    further expected-gap interval (not an escalating multiplier) — so
 *    catching up on one missed drink never means the *next* nudge takes
 *    longer to arrive than usual.
 *  - Engagement cap: how many reminders a user is eligible for per quiet
 *    stretch is capped by how often they've actually opened past reminders
 *    (Notification.openedAt) — a consistently-unresponsive user stays at
 *    exactly today's single reminder; only a responsive user gets more.
 *
 * Dedupes by counting SESSION_REMINDER rows sent *since the session's current
 * endedAt* (i.e. since the last check-in), not the session's whole lifetime —
 * every new check-in pushes endedAt forward and so implicitly resets this
 * count to 0, which is what keeps repeat cadence consistent instead of
 * escalating: a user who keeps forgetting and getting nudged back gets the
 * same ~gap-length wait before each reminder, not a progressively longer one.
 * Only ever sends the *next* slot due, one at a time — even after a long gap
 * in ticks, a quiet stretch catches up one reminder per call rather than
 * bursting several at once.
 */
export async function sendSessionReminders(): Promise<{ sent: number }> {
  const now = Date.now();
  const quietSessions = await db.drinkSession.findMany({
    where: {
      // A session's endedAt is its last check-in's timestamp, so it's never
      // in the future — the only bound needed is the SESSION_GAP_MS floor
      // past which it's permanently closed and no reminder could ever land.
      endedAt: { gt: new Date(now - SESSION_GAP_MS) },
    },
    select: { id: true, userId: true, endedAt: true },
  });
  if (quietSessions.length === 0) return { sent: 0 };

  const existingReminders = await db.notification.findMany({
    where: { type: "SESSION_REMINDER", entryId: { in: quietSessions.map((s) => s.id) } },
    select: { entryId: true, createdAt: true },
  });
  const remindersBySessionId = new Map<string, Date[]>();
  for (const r of existingReminders) {
    if (!r.entryId) continue;
    const list = remindersBySessionId.get(r.entryId);
    if (list) list.push(r.createdAt);
    else remindersBySessionId.set(r.entryId, [r.createdAt]);
  }

  const sessionsByUserId = new Map<string, typeof quietSessions>();
  for (const session of quietSessions) {
    const bucket = sessionsByUserId.get(session.userId);
    if (bucket) bucket.push(session);
    else sessionsByUserId.set(session.userId, [session]);
  }

  const events: NotificationEvent[] = [];
  for (const [userId, sessions] of sessionsByUserId) {
    const [sessionGapsById, historicalGaps, engagement] = await Promise.all([
      getIntraSessionGapsBySessionId(sessions.map((s) => s.id)),
      getIntraSessionGapsForUser(userId),
      getReminderEngagementForUser(userId),
    ]);
    const maxReminders = maxRemindersForEngagement(engagement.openedCount, engagement.resolvedCount);

    for (const session of sessions) {
      const gapMs = expectedGapMs(sessionGapsById.get(session.id) ?? [], historicalGaps);
      const dueSlots = dueSlotsForElapsed(now - session.endedAt.getTime(), gapMs);
      if (dueSlots === 0) continue;

      const sentSinceLastCheckin = (remindersBySessionId.get(session.id) ?? []).filter(
        (createdAt) => createdAt.getTime() > session.endedAt.getTime()
      ).length;
      const targetCount = Math.min(dueSlots, maxReminders);
      if (sentSinceLastCheckin >= targetCount) continue;

      events.push({
        // Generated here, not left to the DB default, so describeNotification
        // can seed the same message variant at push-send time (below) and
        // again whenever the in-app notification list re-derives it from the
        // row.
        id: crypto.randomUUID(),
        userId,
        type: "SESSION_REMINDER" as const,
        entryId: session.id,
      });
    }
  }
  if (events.length === 0) return { sent: 0 };

  queueNotifications(events);
  return { sent: events.length };
}

/**
 * Opportunistic trigger, called off real app traffic (app/(app)/layout.tsx)
 * instead of relying solely on the external cron
 * (.github/workflows/session-reminders.yml) — GitHub Actions' `schedule`
 * trigger doesn't reliably honor a sub-hourly cadence in practice (observed
 * landing closer to hourly, a platform limitation, not a repo config issue),
 * while this fires within the app's own request path every time. Reuses
 * RateLimiterFactory's Postgres-backed fixed-window counter purely as a
 * distributed "has it been 15 minutes since the last tick" debounce: any one
 * of potentially many concurrent requests can win the race and run the real
 * check, everyone else's call is a cheap no-op. The GitHub Actions cron
 * stays in place as a backstop for near-zero-traffic windows (e.g.
 * overnight), since this only fires when someone is actually using the app.
 */
export async function maybeSendSessionReminders(): Promise<void> {
  const { allowed } = await RateLimiterFactory.create().consume(REMINDER_TICK_KEY, 1, REMINDER_TICK_INTERVAL_MS);
  if (!allowed) return;
  await sendSessionReminders();
}
