import { db } from "@/lib/db";
import { queueNotifications, type NotificationEvent } from "@/lib/notify";
import { SESSION_GAP_MS } from "@/lib/sessions";
import { RateLimiterFactory } from "@/lib/rateLimit/RateLimiterFactory";

const REMINDER_TICK_KEY = "session-reminders-tick";
const REMINDER_TICK_INTERVAL_MS = 15 * 60 * 1000;

// A session counts as "gone quiet" once this long has passed since its last
// check-in — long enough that a fresh check-in is unlikely to be seconds
// away, short enough that the reminder still lands well before SESSION_GAP_MS
// closes the session for good.
const QUIET_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

/**
 * Reminds the owner of each still-open-but-quiet session to log their next
 * drink — a logging-completeness nudge, not a "keep drinking" prompt (see
 * lib/notifications.ts's SESSION_REMINDER copy). Meant to be called
 * periodically (app/api/cron/session-reminders/route.ts); dedupes against
 * Notification rows already sent for a session so a still-quiet session
 * doesn't get re-reminded on every tick.
 */
export async function sendSessionReminders(): Promise<{ sent: number }> {
  const now = Date.now();
  const quietSessions = await db.drinkSession.findMany({
    where: {
      endedAt: {
        lt: new Date(now - QUIET_THRESHOLD_MS),
        gt: new Date(now - SESSION_GAP_MS),
      },
    },
    select: { id: true, userId: true },
  });
  if (quietSessions.length === 0) return { sent: 0 };

  const alreadyReminded = await db.notification.findMany({
    where: {
      type: "SESSION_REMINDER",
      entryId: { in: quietSessions.map((s) => s.id) },
    },
    select: { entryId: true },
  });
  const remindedIds = new Set(alreadyReminded.map((n) => n.entryId));
  const toRemind = quietSessions.filter((s) => !remindedIds.has(s.id));
  if (toRemind.length === 0) return { sent: 0 };

  const events: NotificationEvent[] = toRemind.map((s) => ({
    // Generated here, not left to the DB default, so describeNotification
    // can seed the same message variant at push-send time (below) and again
    // whenever the in-app notification list re-derives it from the row.
    id: crypto.randomUUID(),
    userId: s.userId,
    type: "SESSION_REMINDER" as const,
    entryId: s.id,
  }));
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
