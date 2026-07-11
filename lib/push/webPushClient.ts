import webpush from "web-push";

let configured = false;

/** Configures the web-push client from env once, lazily (first send). */
export function getWebPushClient(): typeof webpush {
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    configured = true;
  }
  return webpush;
}
