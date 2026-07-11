import { db } from "@/lib/db";
import { NotificationMapper } from "@/lib/mappers";
import type { NotificationDTO } from "@/lib/dtos";

export async function getNotifications(
  userId: string,
  { limit, offset }: { limit: number; offset: number }
): Promise<NotificationDTO[]> {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
  return rows.map(NotificationMapper.toDTO);
}

export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

/** Whether the user has push enabled on any device — used to nudge them toward the profile toggle if not. */
export async function hasAnyPushSubscription(userId: string): Promise<boolean> {
  const count = await db.pushSubscription.count({ where: { userId } });
  return count > 0;
}
