"use client";

import { useEffect, useState } from "react";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/controllers/notificationController";
import { showToast } from "@/components/ui/toast-pill";

type Status = "checking" | "unsupported" | "denied" | "off" | "on";

const SUBSCRIBE_TIMEOUT_MS = 10_000;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export function PushSubscribeToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setStatus(subscription ? "on" : "off"))
      .catch(() => setStatus("off"));
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    setTimedOut(false);
    let settled = false;

    // The browser call can resolve well after we've given up waiting on it
    // below (observed in the wild: a stuck OS-level notification permission
    // makes subscribe() hang, then silently succeed once it's fixed, seconds
    // after our timeout already fired). Complete registration whenever it
    // actually resolves, not just on the fast path, so it's never dangling.
    const completeSuccess = async (subscription: PushSubscription) => {
      if (settled) return;
      settled = true;
      const json = subscription.toJSON();
      await subscribeToPush({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      });
      setStatus("on");
      setTimedOut(false);
    };

    try {
      // iOS Safari only honors Notification.requestPermission() while the call
      // is still inside the click's synchronous user-activation window — any
      // await before it (even a fast one) silently drops the permission prompt,
      // and every subscribe() call after that hangs until our timeout fires.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const registration = await withTimeout(navigator.serviceWorker.getRegistration(), SUBSCRIBE_TIMEOUT_MS);
      if (!registration) {
        showToast("Push isn't available in this build — try the deployed app.");
        return;
      }
      const subscribePromise = registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
      });
      subscribePromise.then(completeSuccess).catch(() => {});

      const subscription = await withTimeout(subscribePromise, SUBSCRIBE_TIMEOUT_MS);
      await completeSuccess(subscription);
    } catch (e) {
      if (e instanceof Error && e.message === "timeout") {
        setTimedOut(true);
      } else if (!settled) {
        showToast("Couldn't enable push notifications.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setTimedOut(false);
    let settled = false;

    const completeSuccess = () => {
      if (settled) return;
      settled = true;
      setStatus("off");
      setTimedOut(false);
    };

    try {
      const registration = await withTimeout(navigator.serviceWorker.getRegistration(), SUBSCRIBE_TIMEOUT_MS);
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        completeSuccess();
        return;
      }
      await unsubscribeFromPush({ endpoint: subscription.endpoint });
      const unsubscribePromise = subscription.unsubscribe();
      unsubscribePromise.then(completeSuccess).catch(() => {});

      await withTimeout(unsubscribePromise, SUBSCRIBE_TIMEOUT_MS);
      completeSuccess();
    } catch (e) {
      if (e instanceof Error && e.message === "timeout") {
        setTimedOut(true);
      } else if (!settled) {
        showToast("Couldn't disable push notifications.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (status === "checking") return null;

  const description =
    status === "on"
      ? "You'll get notified on this device."
      : "Get notified the moment someone cheers, follows, or logs a session.";

  return (
    <div className="section" id="push-notifications">
      <div className="switch-row">
        <div className="rowmark">
          <svg viewBox="0 0 24 24">
            <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.7 21a2 2 0 01-3.4 0"></path>
          </svg>
        </div>
        <div className="grow">
          <b>Push notifications</b>
          <p>
            {status === "unsupported"
              ? "Not available in this browser. Install Birava to your home screen to enable push."
              : status === "denied"
                ? "Blocked in your browser. Enable notifications for this site, then reload the page."
                : description}
          </p>
        </div>
        {status !== "unsupported" && status !== "denied" && (
          <button
            role="switch"
            aria-checked={status === "on"}
            aria-label="Push notifications"
            className={`switch${status === "on" ? " on" : ""}`}
            disabled={busy}
            onClick={status === "on" ? handleDisable : handleEnable}
          />
        )}
      </div>
      {timedOut && (
        <div className="callout warn" style={{ marginTop: 14 }}>
          <div className="mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01"></path>
              <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"></path>
            </svg>
          </div>
          <div>
            <b>This is taking longer than expected</b>
            <p>
              Check that notifications are allowed for this app in your phone&apos;s system settings
              (on Android: Settings → Apps → Chrome/Birava → Notifications), then try again.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
