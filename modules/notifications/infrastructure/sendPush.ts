import { WebPushError } from "web-push";
import { getWebPushClient } from "@/modules/notifications/infrastructure/webPushClient";
import { Env } from "@/lib/env/Env";
import { LoggerFactory } from "@/lib/logging/LoggerFactory";
import type { IPushSender, PushPayload } from "@/modules/notifications/domain/IPushSender";
import type { IPushSubscriptionRepository } from "@/modules/notifications/domain/IPushSubscriptionRepository";

const logger = LoggerFactory.create("push");

/** Best-effort push to every device the user has subscribed from. Silently drops dead subscriptions. */
export class WebPushSender implements IPushSender {
  constructor(private readonly subscriptions: IPushSubscriptionRepository) {}

  async send(userId: string, payload: PushPayload): Promise<void> {
    if (!Env.server.VAPID_PRIVATE_KEY) return;

    const subscriptions = await this.subscriptions.forUser(userId);
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
            await this.subscriptions.removeByEndpoint(sub.endpoint);
            return;
          }
          // Anything else (bad payload, rate-limited, a misconfigured/rotated
          // VAPID key breaking every send) was previously swallowed with zero
          // signal — a systemic failure here would silently drop 100% of push
          // notifications with nothing in any log to notice it by. Not a dead
          // subscription, so it's left in place to retry on the next send.
          logger.error("push send failed", { userId, error: err });
        }
      })
    );
  }
}
