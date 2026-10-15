import type { PrismaClient } from "@prisma/client";
import type { IPushSubscriptionRepository, StoredPushSubscription } from "@/modules/notifications/domain/IPushSubscriptionRepository";

export class PrismaPushSubscriptionRepository implements IPushSubscriptionRepository {
  constructor(private readonly db: PrismaClient) {}

  async forUser(userId: string): Promise<StoredPushSubscription[]> {
    return this.db.pushSubscription.findMany({ where: { userId }, select: { endpoint: true, p256dh: true, auth: true } });
  }

  async removeByEndpoint(endpoint: string): Promise<void> {
    await this.db.pushSubscription.deleteMany({ where: { endpoint } });
  }
}
