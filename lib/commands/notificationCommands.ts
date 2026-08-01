import { db } from "@/lib/db";
import type { UpdateNotificationPreferenceDTO } from "@/lib/dtos";

export async function markAllRead(userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function updateNotificationPreference(
  userId: string,
  input: UpdateNotificationPreferenceDTO
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { [input.key]: input.enabled },
  });
}
