/** A single notification-list item, ready to render. */
export class NotificationDTO {
  declare id: string;
  declare type: string;
  declare message: string;
  declare href: string;
  declare actorId: string | null;
  declare actorAvatarUrl: string | null;
  declare read: boolean;
  declare createdAt: string;
}
