import type { NotificationType } from "./notifications";

/** Something that happened which a user should be told about. Written as a Notification row and, if their preferences allow, sent as a push. */
export type NotificationEvent = {
  // Only set when the caller needs the same id available at push-send time
  // as at read time (e.g. SESSION_REMINDER's message-variant seed) —
  // otherwise left to the DB's @default(uuid()).
  id?: string;
  userId: string;
  type: NotificationType;
  actorId?: string;
  actorUsername?: string;
  actorAvatarUrl?: string | null;
  entryId?: string;
  groupId?: string;
  groupName?: string;
  achievementLabel?: string;
};
