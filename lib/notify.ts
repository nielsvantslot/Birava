import { after } from "next/server";
import { db } from "@/lib/db";
import type { NotificationType } from "@prisma/client";
import { sendPushToUser } from "@/lib/push/sendPush";
import { describeNotification } from "@/lib/notifications";

export type NotificationEvent = {
  userId: string;
  type: NotificationType;
  actorId?: string;
  actorUsername?: string;
  actorAvatarUrl?: string | null;
  entryId?: string;
  groupId?: string;
  groupName?: string;
  achievementLabel?: string;
};

/**
 * Writes notification rows + sends push, deferred via `after()` so the
 * triggering mutation (proost, follow, check-in, ...) isn't slowed down by it.
 */
export function queueNotifications(events: NotificationEvent[]) {
  const filtered = events.filter((e) => e.userId !== e.actorId);
  if (filtered.length === 0) return;

  after(async () => {
    await db.notification.createMany({ data: filtered });
    await Promise.allSettled(
      filtered.map((e) => {
        const { message, href } = describeNotification(e.type, e);
        return sendPushToUser(e.userId, { title: "Birava", body: message, url: href });
      })
    );
  });
}
