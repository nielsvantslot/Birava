import type { NotificationEvent } from "./NotificationEvent";

/** What the notification flow needs from storage. The Prisma implementation is in infrastructure/; tests use an in-memory one. */
export interface INotificationRepository {
  /** Writes every event in one statement; rejects if any single row is bad, in which case none is written. */
  createMany(events: NotificationEvent[]): Promise<void>;
  create(event: NotificationEvent): Promise<void>;
  /**
   * For each user, the preference categories they have turned off. Sparse by
   * design: a category with no row is still at its default, enabled, so a user
   * who never touched settings has no entry here at all.
   */
  disabledCategories(userIds: string[]): Promise<Map<string, Set<string>>>;
}
