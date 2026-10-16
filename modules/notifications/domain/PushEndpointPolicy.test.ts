import { describe, expect, it } from "vitest";
import { PushEndpointPolicy } from "./PushEndpointPolicy";

describe("PushEndpointPolicy", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QWxs",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "https://us-west.push.services.mozilla.com/x",
  ])("accepts %s", (endpoint) => {
    expect(PushEndpointPolicy.isAllowed(endpoint)).toBe(true);
  });

  it.each([
    "http://127.0.0.1:9999/ssrf",
    "https://169.254.169.254/latest/meta-data",
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com.evil.example/x",
    "https://evil.example/fcm.googleapis.com",
    "https://user:pw@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "https://notify.windows.com.evil.example/x",
    "https://evilnotify.windows.com/x",
    "javascript:alert(1)",
    "not a url",
    "",
  ])("rejects %s", (endpoint) => {
    expect(PushEndpointPolicy.isAllowed(endpoint)).toBe(false);
  });
});
