import webpush from "web-push";

let configured = false;

/** Configures the web-push client from env once, lazily (first send). */
export function getWebPushClient(): typeof webpush {
  if (!configured) {
    const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
    if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("Missing VAPID_SUBJECT/VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY env vars.");
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  }
  return webpush;
}
