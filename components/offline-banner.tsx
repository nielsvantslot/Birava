"use client";

import { useEffect, useState } from "react";

/**
 * Visible whenever the browser reports no connectivity. A page shown while
 * offline is the service worker's last-cached copy of that URL (public/sw.js),
 * not a live render, so this tells the user what they're looking at isn't
 * necessarily current — logging a drink still works regardless (queued via
 * lib/offline/pendingCheckins.ts).
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--line)",
        color: "var(--ink-dim)",
        fontSize: 12.5,
        fontWeight: 700,
        textAlign: "center",
        padding: "6px 12px",
      }}
    >
      You&apos;re offline — showing your last synced view
    </div>
  );
}
