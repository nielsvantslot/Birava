import { db } from "@/lib/db";
import { getWebPushClient } from "@/lib/push/webPushClient";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
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
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
        }
      }
    })
  );
}
