"use client";

import { useEffect, useState } from "react";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/controllers/notificationController";
import { showToast } from "@/components/ui/toast-pill";

type Status = "checking" | "unsupported" | "subscribed" | "unsubscribed";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushSubscribeToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setStatus(subscription ? "subscribed" : "unsubscribed"))
      .catch(() => setStatus("unsubscribed"));
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        showToast("Push isn't available in this build — try the deployed app.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        showToast("Notifications permission was denied.");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
      });
      const json = subscription.toJSON();
      await subscribeToPush({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      });
      setStatus("subscribed");
    } catch {
      showToast("Couldn't enable push notifications.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPush({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setStatus("unsubscribed");
    } catch {
      showToast("Couldn't disable push notifications.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "checking") return null;

  return (
    <div className="section">
      <div className="h-row" style={{ marginBottom: 6 }}>
        <h3>Push notifications</h3>
      </div>
      {status === "unsupported" ? (
        <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
          Not available in this browser. Install Birava to your home screen to enable push.
        </p>
      ) : (
        <button
          className="btn btn-ghost"
          disabled={busy}
          onClick={status === "subscribed" ? handleDisable : handleEnable}
        >
          {status === "subscribed" ? "Turn off push notifications" : "Turn on push notifications"}
        </button>
      )}
    </div>
  );
}
