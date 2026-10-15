import type { INotificationRepository } from "@/modules/notifications/domain/INotificationRepository";
import type { NotificationEvent } from "@/modules/notifications/domain/NotificationEvent";

/**
 * An in-memory `INotificationRepository`. `userIdsThatFailToInsert` mimics a
 * stale recipient (an account deleted before the deferred write): a batch
 * containing one rejects as a whole, exactly like a real single INSERT.
 */
export class InMemoryNotificationRepository implements INotificationRepository {
  readonly rows: NotificationEvent[] = [];
  readonly userIdsThatFailToInsert = new Set<string>();
  /** userId -> categories switched off. */
  readonly disabled = new Map<string, Set<string>>();

  async createMany(events: NotificationEvent[]): Promise<void> {
    if (events.some((e) => this.userIdsThatFailToInsert.has(e.userId))) throw new Error("foreign key violation");
    this.rows.push(...events);
  }

  async create(event: NotificationEvent): Promise<void> {
    if (this.userIdsThatFailToInsert.has(event.userId)) throw new Error("foreign key violation");
    this.rows.push(event);
  }

  async disabledCategories(userIds: string[]): Promise<Map<string, Set<string>>> {
    return new Map([...this.disabled].filter(([userId]) => userIds.includes(userId)));
  }
}
