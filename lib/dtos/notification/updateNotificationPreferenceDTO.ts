export const NOTIFICATION_PREFERENCE_KEYS = [
  "notifyCrewCheckin",
  "notifyCheer",
  "notifyCrewActivity",
  "notifyAchievement",
  "notifyFollowing",
] as const;

export type NotificationPreferenceKey = (typeof NOTIFICATION_PREFERENCE_KEYS)[number];

export class UpdateNotificationPreferenceDTO {
  declare key: NotificationPreferenceKey;
  declare enabled: boolean;
}
