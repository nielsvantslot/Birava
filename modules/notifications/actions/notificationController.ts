"use server";

import { revalidatePath } from "next/cache";
import { gateway } from "@/modules/identity/server/gateway";
import {
  markAllRead,
  markNotificationOpened,
  updateNotificationPreference as updateNotificationPreferenceCommand,
} from "@/modules/notifications/application/notificationCommands";
import {
  savePushSubscription as savePushSubscriptionCommand,
  removePushSubscription as removePushSubscriptionCommand,
} from "@/modules/notifications/application/pushSubscriptionCommands";
import {
  notificationIdInput,
  removePushSubscriptionInput,
  savePushSubscriptionInput,
  updateNotificationPreferenceInput,
} from "@/modules/notifications/contract/notificationContract";

// Mutations only: reads live in modules/notifications/server/notificationReads.ts (a Server Action is a public POST endpoint).

export const markNotificationsRead = gateway.action.authed({ name: "notifications.mark-all-read" }, async ({ user }) => {
  await markAllRead(user.id);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
});

/** Fired on click-through of a single notification row (see notification-row-link.tsx) — not blocking navigation. */
export const markNotificationOpenedAction = gateway.action.authed(
  { name: "notifications.mark-opened", input: notificationIdInput },
  async ({ user, input }) => {
    await markNotificationOpened(input, user.id);
  }
);

export const subscribeToPush = gateway.action.authed(
  { name: "notifications.subscribe-push", input: savePushSubscriptionInput },
  async ({ user, input }) => {
    await savePushSubscriptionCommand(user.id, input);
  }
);

export const unsubscribeFromPush = gateway.action.authed(
  { name: "notifications.unsubscribe-push", input: removePushSubscriptionInput },
  async ({ user, input }) => {
    await removePushSubscriptionCommand(user.id, input.endpoint);
  }
);

export const updateNotificationPreference = gateway.action.authed(
  { name: "notifications.update-preference", input: updateNotificationPreferenceInput },
  async ({ user, input }) => {
    await updateNotificationPreferenceCommand(user.id, input);
    revalidatePath("/settings");
  }
);
