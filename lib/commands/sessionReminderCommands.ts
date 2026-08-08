import { db } from "@/lib/db";
import { queueNotifications, type NotificationEvent } from "@/lib/notify";
import { SESSION_GAP_MS } from "@/lib/sessions";
import { RateLimiterFactory } from "@/lib/rateLimit/RateLimiterFactory";
import { getIntraSessionGapsForUser, getReminderEngagementForUser } from "@/lib/queries/reminderAlgorithmQueries";
import {
  dueTierForElapsed,
  maxRemindersForEngagement,
  medianGapMs,
  personalizedQuietThresholdMs,
  tierBoundariesMs,
} from "@/lib/sessionReminderAlgorithm";

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
 *  - Personalized timing: "gone quiet" is measured against the user's own
 *    median intra-session check-in gap, not a fixed 1h for everyone.
 *  - Escalation: up to 3 reminders per session, at increasing tiers off that
 *    personalized threshold, instead of a single one-shot nudge.
 *  - Engagement cap: how many tiers a user is eligible for is capped by how
 *    often they've actually opened past reminders (Notification.openedAt) —
 *    a consistently-unresponsive user stays at exactly today's single
 *    reminder; only a responsive user gets the extra escalation tiers.
 *
 * Dedupes by counting existing SESSION_REMINDER rows per session (generalized
 * from the old boolean exists-check) and only ever sends the *next* tier due,
 * one at a time — even after a long gap in ticks, a session catches up one
 * reminder per call rather than bursting several tiers at once.
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
    select: { entryId: true },
  });
  const existingCountBySessionId = new Map<string, number>();
  for (const r of existingReminders) {
    if (!r.entryId) continue;
    existingCountBySessionId.set(r.entryId, (existingCountBySessionId.get(r.entryId) ?? 0) + 1);
  }

  const sessionsByUserId = new Map<string, typeof quietSessions>();
  for (const session of quietSessions) {
    const bucket = sessionsByUserId.get(session.userId);
    if (bucket) bucket.push(session);
    else sessionsByUserId.set(session.userId, [session]);
  }

  const events: NotificationEvent[] = [];
  for (const [userId, sessions] of sessionsByUserId) {
    const [gaps, engagement] = await Promise.all([
      getIntraSessionGapsForUser(userId),
      getReminderEngagementForUser(userId),
    ]);
    const threshold = personalizedQuietThresholdMs(medianGapMs(gaps));
    const tiers = tierBoundariesMs(threshold);
    const maxReminders = maxRemindersForEngagement(engagement.openedCount, engagement.resolvedCount);

    for (const session of sessions) {
      const existingCount = existingCountBySessionId.get(session.id) ?? 0;
      const dueTier = dueTierForElapsed(now - session.endedAt.getTime(), tiers);
      const targetCount = Math.min(dueTier, maxReminders);
      if (existingCount >= targetCount) continue;

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
