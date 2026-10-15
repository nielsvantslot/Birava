import { getCurrentUser } from "@/modules/identity/server/session";
import {
  getNotifications,
  getUnreadCount,
  hasAnyPushSubscription,
  getNotificationPreferences,
} from "@/modules/notifications/server/notificationQueries";
import type { GetMyNotificationsDTO, NotificationDTO, NotificationPreferencesDTO } from "@/lib/dtos";

// Reads for pages. Deliberately not Server Actions: every export of a
// "use server" file is a public POST endpoint, and a read has no business
// being one.

export async function getMyNotifications(
  input: GetMyNotificationsDTO = { limit: 30, offset: 0 }
): Promise<NotificationDTO[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return getNotifications(user.id, input);
}

export async function getMyUnreadNotificationCount(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;

  return getUnreadCount(user.id);
}

/** Whether the current user has push enabled on any device. */
export async function getMyHasPushSubscription(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  return hasAnyPushSubscription(user.id);
}

const DEFAULT_PREFERENCES: NotificationPreferencesDTO = {
  notifyCrewCheckin: true,
  notifyCheer: true,
  notifyCrewActivity: true,
  notifyAchievement: true,
  notifyFollowing: true,
  notifySessionReminder: true,
};

export async function getMyNotificationPreferences(): Promise<NotificationPreferencesDTO> {
  const user = await getCurrentUser();
  if (!user) return DEFAULT_PREFERENCES;

  return getNotificationPreferences(user.id);
}
