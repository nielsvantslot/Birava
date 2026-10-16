import { z } from "zod";
import { ContractFields } from "@/lib/gateway/ContractFields";
import { NOTIFICATION_PREFERENCE_KEYS } from "@/lib/dtos";
import { PushEndpointPolicy } from "@/modules/notifications/domain/PushEndpointPolicy";

/** `subscribeToPush`: a browser PushSubscription's JSON. */
export const savePushSubscriptionInput = z.object({
  endpoint: z.string().min(1).max(2048).refine(PushEndpointPolicy.isAllowed, "That isn't a push service endpoint."),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

/** `unsubscribeFromPush`. */
export const removePushSubscriptionInput = z.object({ endpoint: z.string().min(1).max(2048) });

/** `updateNotificationPreference`. */
export const updateNotificationPreferenceInput = z.object({
  key: z.enum(NOTIFICATION_PREFERENCE_KEYS),
  enabled: z.boolean(),
});

/** `markNotificationOpenedAction`: just the notification's id. */
export const notificationIdInput = ContractFields.id;
