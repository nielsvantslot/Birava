import type { NotificationType } from "@prisma/client";

export type NotificationContent = {
  actorUsername?: string | null;
  entryId?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  achievementLabel?: string | null;
};

/** Message + link for a notification event, shared by write-time push copy and the read-side list. */
export function describeNotification(
  type: NotificationType,
  content: NotificationContent
): { message: string; href: string } {
  const actor = content.actorUsername ?? "Someone";

  switch (type) {
    case "CHEER":
      return { message: `${actor} cheered your session`, href: `/sessions/${content.entryId}` };
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
  }
}
