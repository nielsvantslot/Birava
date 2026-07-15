import { cache } from "react";
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

// AppLayout renders both the mobile header and the desktop sidebar on every
// request (CSS hides whichever doesn't match the viewport) — both call this,
// so without request-level memoization it ran twice per navigation.
export const getUnreadCount = cache(async (userId: string): Promise<number> => {
  return db.notification.count({ where: { userId, readAt: null } });
});

/** Whether the user has push enabled on any device — used to nudge them toward the profile toggle if not. */
export async function hasAnyPushSubscription(userId: string): Promise<boolean> {
  const count = await db.pushSubscription.count({ where: { userId } });
  return count > 0;
}
