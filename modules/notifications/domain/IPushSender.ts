export type PushPayload = {
  title: string;
  body: string;
  url: string;
  // The originating Notification row's id, when known at send time (see
  // NotificationEvent.id) — lets the service worker report opens back
  // (public/sw.js's notificationclick handler) for types that read
  // Notification.openedAt (SESSION_REMINDER's engagement cap).
  id?: string;
};

/** Sends a web push to everything a user has subscribed from. Best effort: it never throws for a delivery problem. */
export interface IPushSender {
  send(userId: string, payload: PushPayload): Promise<void>;
}
