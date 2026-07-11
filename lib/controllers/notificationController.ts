"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { throwNotAuthenticated } from "@/lib/auth/authErrors";
import { getNotifications, getUnreadCount, hasAnyPushSubscription } from "@/lib/queries/notificationQueries";
import { markAllRead } from "@/lib/commands/notificationCommands";
import {
  savePushSubscription as savePushSubscriptionCommand,
  removePushSubscription as removePushSubscriptionCommand,
} from "@/lib/commands/pushSubscriptionCommands";
import {
  GetMyNotificationsDTO,
  NotificationDTO,
  RemovePushSubscriptionDTO,
  SavePushSubscriptionDTO,
} from "@/lib/dtos";

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

export async function markNotificationsRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throwNotAuthenticated();

  await markAllRead(user.id);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function subscribeToPush(input: SavePushSubscriptionDTO): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throwNotAuthenticated();

  await savePushSubscriptionCommand(user.id, input);
}

export async function unsubscribeFromPush(input: RemovePushSubscriptionDTO): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throwNotAuthenticated();

  await removePushSubscriptionCommand(user.id, input.endpoint);
}
