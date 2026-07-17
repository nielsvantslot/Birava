export class SavePushSubscriptionDTO {
  declare endpoint: string;
  declare keys: { p256dh: string; auth: string };
}
