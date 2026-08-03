import type { NotificationType } from "@prisma/client";

export type NotificationContent = {
  id?: string | null;
  actorUsername?: string | null;
  entryId?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  achievementLabel?: string | null;
};

// Rotated so a quiet session doesn't get the exact same nudge every time —
// all purely about logging completeness, never about drinking more (see the
// SESSION_REMINDER case below).
const SESSION_REMINDER_VARIANTS = [
  "Your session is still open — log what you're having",
  "Still going? Add your next drink before the session closes",
  "Don't forget to log your last round",
  "Your session's waiting on an update",
  "Quick one — log what you just had while it's fresh",
  "Session's still open. Add a check-in whenever you're ready",
  "Keep tonight's session accurate — log your next drink",
  "A gap in the session? Add what you've had since",
];

// Deterministic, not random: this runs once at write time (for the push
// payload) and again at read time (for the in-app list), and both must pick
// the same variant for the same notification.
function pickSessionReminderVariant(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return SESSION_REMINDER_VARIANTS[Math.abs(hash) % SESSION_REMINDER_VARIANTS.length];
}

/** Message + link for a notification event, shared by write-time push copy and the read-side list. */
export function describeNotification(
  type: NotificationType,
  content: NotificationContent
): { message: string; href: string } {
  const actor = content.actorUsername ?? "Someone";

  switch (type) {
    case "CHEER":
      return { message: `${actor} cheered your session`, href: `/sessions/${content.entryId}` };
    case "COMMENT":
      return { message: `${actor} commented on your session`, href: `/sessions/${content.entryId}#comments` };
    case "FOLLOW":
      return { message: `${actor} started following you`, href: `/profile/${actor}` };
    case "CREW_JOIN":
      return { message: `${actor} joined ${content.groupName}`, href: `/crews/${content.groupId}` };
    case "CREW_CHECKIN":
      return {
        message: `${actor} logged a check-in in ${content.groupName}`,
        href: `/crews/${content.groupId}`,
      };
    case "ACHIEVEMENT":
      return { message: `You earned ${content.achievementLabel}`, href: "/achievements" };
    case "SESSION_START":
      return { message: `${actor} started a session`, href: `/sessions/${content.entryId}` };
    case "CREW_INVITE":
      // Not /crews/[id]: the invitee isn't a member yet, so that page would
      // 404 for them until they accept — the notifications list renders
      // accept/decline actions inline instead of relying on this link.
      return { message: `${actor} invited you to join ${content.groupName}`, href: `/profile/${actor}` };
    case "SESSION_REMINDER":
      // Fires only while the session (lib/sessions.ts's SESSION_GAP_MS) is
      // still open. content.entryId holds the session id, same convention
      // CHEER/SESSION_START use. content.id seeds which variant is picked —
      // see pickSessionReminderVariant above.
      return {
        message: pickSessionReminderVariant(content.id ?? content.entryId ?? ""),
        href: `/sessions/${content.entryId}`,
      };
  }
}
