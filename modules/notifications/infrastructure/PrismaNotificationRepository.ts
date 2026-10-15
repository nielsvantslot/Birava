import type { PrismaClient } from "@prisma/client";
import type { INotificationRepository } from "@/modules/notifications/domain/INotificationRepository";
import type { NotificationEvent } from "@/modules/notifications/domain/NotificationEvent";

export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private readonly db: PrismaClient) {}

  async createMany(events: NotificationEvent[]): Promise<void> {
    await this.db.notification.createMany({ data: events });
  }

  async create(event: NotificationEvent): Promise<void> {
    await this.db.notification.create({ data: event });
  }

  async disabledCategories(userIds: string[]): Promise<Map<string, Set<string>>> {
    const overrides = await this.db.notificationPreference.findMany({ where: { userId: { in: userIds } } });
    const disabled = new Map<string, Set<string>>();
    for (const override of overrides) {
      if (override.enabled) continue;
      const keys = disabled.get(override.userId) ?? new Set<string>();
      keys.add(override.key);
      disabled.set(override.userId, keys);
    }
    return disabled;
  }
}
