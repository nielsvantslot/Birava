import { db } from "@/lib/db";
import type { UpdateNotificationPreferenceDTO } from "@/lib/dtos";

export async function markAllRead(userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

/**
 * Records that a user actually clicked through this specific notification —
 * independent of markAllRead's bulk readAt. The `openedAt: null` guard makes
 * this a one-time "first opened" timestamp rather than a last-clicked one,
 * and the `userId` filter keeps a user from ever marking someone else's row.
 */
export async function markNotificationOpened(notificationId: string, userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { id: notificationId, userId, openedAt: null },
    data: { openedAt: new Date() },
  });
}

/**
 * Upserts unconditionally, including when `enabled` matches the default
 * (`true`) — not deleting the row on a revert-to-default. Simpler than
 * chasing perfect sparseness (no separate delete path to reason about),
 * at the cost of the table not being quite as minimal as it could be for
 * a user who toggles a category back and forth.
 */
export async function updateNotificationPreference(
  userId: string,
  input: UpdateNotificationPreferenceDTO
): Promise<void> {
  await db.notificationPreference.upsert({
    where: { userId_key: { userId, key: input.key } },
    create: { userId, key: input.key, enabled: input.enabled },
    update: { enabled: input.enabled },
  });
}
