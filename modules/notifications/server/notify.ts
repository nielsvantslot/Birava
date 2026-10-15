import { after } from "next/server";
import { db } from "@/lib/db";
import { NotificationDispatcher } from "@/modules/notifications/application/NotificationDispatcher";
import type { NotificationEvent } from "@/modules/notifications/domain/NotificationEvent";
import { PrismaNotificationRepository } from "@/modules/notifications/infrastructure/PrismaNotificationRepository";
import { PrismaPushSubscriptionRepository } from "@/modules/notifications/infrastructure/PrismaPushSubscriptionRepository";
import { WebPushSender } from "@/modules/notifications/infrastructure/sendPush";

export type { NotificationEvent };

/** Composition root for notifications: Prisma storage and web push behind the dispatcher. */
const dispatcher = new NotificationDispatcher(
  new PrismaNotificationRepository(db),
  new WebPushSender(new PrismaPushSubscriptionRepository(db))
);

/**
 * Writes notification rows + sends push, deferred via `after()` so the
 * triggering mutation (cheers, follow, check-in, ...) isn't slowed down by it.
 * What gets written and who gets a push is NotificationDispatcher's job.
 */
export function queueNotifications(events: NotificationEvent[]) {
  const filtered = events.filter((e) => e.userId !== e.actorId);
  if (filtered.length === 0) return;

  after(() => dispatcher.dispatch(filtered));
}
