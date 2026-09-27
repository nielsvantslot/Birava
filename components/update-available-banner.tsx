"use client";

import { useEffect, useState } from "react";
import { UpdateAvailableSignal } from "@/lib/serviceWorkerUpdate/UpdateAvailableSignal";

/**
 * Surfaces the reload ServiceWorkerRegistration deferred because
 * FormDirtyTracker said the user had unsaved input on screen when a new
 * service worker took over. Without this, that deferred reload would only
 * ever complete once the form happens to go clean on its own (submit,
 * clear, navigate away) — silent, with no way for the user to ask for it
 * sooner if they've already finished for the moment. "Refresh now" bypasses
 * the dirty check entirely: at that point it's the user's own informed
 * choice to lose whatever's still on screen, not something done to them.
 */
export function UpdateAvailableBanner() {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (UpdateAvailableSignal.isPending()) setPending(true);
    return UpdateAvailableSignal.onPending(() => setPending(true));
  }, []);

  if (!pending) return null;

  return (
    <div
      role="status"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 51,
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--line)",
        color: "var(--ink-dim)",
        fontSize: 12.5,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "6px 12px",
      }}
    >
      <span>Update available</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          fontWeight: 700,
          textDecoration: "underline",
          background: "none",
          border: "none",
          color: "var(--accent)",
          cursor: "pointer",
          padding: 0,
        }}
      >
        Refresh now
      </button>
    </div>
  );
}
