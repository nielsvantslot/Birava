/**
 * Which URLs may be used as a web-push endpoint. The server POSTs to whatever endpoint a user
 * subscribes with, signed with its VAPID key, so an unchecked endpoint turns every notification
 * into a request to an address the user chose (internal services, cloud metadata, anything).
 * Real browsers only ever hand out endpoints on their vendor's push service, so those are the
 * only hosts accepted.
 */
export class PushEndpointPolicy {
  private static readonly EXACT_HOSTS = [
    "fcm.googleapis.com", // Chrome, Edge, Opera, Brave, Samsung Internet
    "android.googleapis.com",
    "updates.push.services.mozilla.com", // Firefox
    "web.push.apple.com", // Safari and installed iOS web apps
  ];

  private static readonly HOST_SUFFIXES = [
    ".push.services.mozilla.com",
    ".push.apple.com",
    ".notify.windows.com", // Edge on Windows (WNS)
  ];

  static isAllowed(endpoint: string): boolean {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      return false;
    }
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return (
      PushEndpointPolicy.EXACT_HOSTS.includes(host) ||
      PushEndpointPolicy.HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
    );
  }
}
