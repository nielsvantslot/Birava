import { WebPushError } from "web-push";
import { db } from "@/lib/db";
import { getWebPushClient } from "@/lib/push/webPushClient";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  // The originating Notification row's id, when known at send time (see
  // NotificationEvent.id) — lets the service worker report opens back
  // (public/sw.js's notificationclick handler) for types that read
  // Notification.openedAt (SESSION_REMINDER's engagement cap).
  id?: string;
};

/** Best-effort push to every device the user has subscribed from. Silently drops dead subscriptions. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!process.env.VAPID_PRIVATE_KEY) return;

  const subscriptions = await db.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  const webpush = getWebPushClient();
  const body = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (err) {
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          await db.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
          return;
        }
        // Anything else (bad payload, rate-limited, a misconfigured/rotated
        // VAPID key breaking every send) was previously swallowed with zero
        // signal — a systemic failure here would silently drop 100% of push
        // notifications with nothing in any log to notice it by. Not a dead
        // subscription, so it's left in place to retry on the next send.
        console.error("sendPushToUser: push send failed", err);
      }
    })
  );
}
