import type { Notification as NotificationRow } from "@prisma/client";
import type { NotificationDTO } from "@/lib/dtos";
import { describeNotification } from "@/lib/notifications";

export class NotificationMapper {
  static toDTO(row: NotificationRow): NotificationDTO {
    const { message, href } = describeNotification(row.type, row);
    return {
      id: row.id,
      type: row.type,
      message,
      href,
      actorId: row.actorId,
      actorAvatarUrl: row.actorAvatarUrl,
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
