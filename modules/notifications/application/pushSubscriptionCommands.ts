import { db } from "@/lib/db";
import { SavePushSubscriptionDTO } from "@/lib/dtos";

export async function savePushSubscription(userId: string, input: SavePushSubscriptionDTO): Promise<void> {
  await db.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: { userId, p256dh: input.keys.p256dh, auth: input.keys.auth },
    create: {
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
    },
  });
}

export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
}
