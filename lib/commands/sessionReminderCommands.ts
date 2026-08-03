import { db } from "@/lib/db";
import { queueNotifications, type NotificationEvent } from "@/lib/notify";
import { SESSION_GAP_MS } from "@/lib/sessions";

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
