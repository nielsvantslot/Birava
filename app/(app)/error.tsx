"use client";

import { useEffect } from "react";

// Scoped to the (app) route group — sits inside AppLayout's <main>, so the
// header/sidebar/bottom nav stay mounted and usable when a single page's
// render or data fetch throws, instead of the whole shell disappearing
// behind app/global-error.tsx. Unlike that last-resort fallback, globals.css
// is already loaded here (the rest of the shell rendered fine), so real
// var()-based classes are safe to use.
export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/debug/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "error-boundary",
        message: error.message,
        stack: error.stack,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 6,
        padding: "48px 20px",
      }}
    >
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
        Something went wrong
      </p>
      <p style={{ fontSize: 14, color: "var(--ink-dim)", margin: "0 0 10px" }}>
        Please try again.
      </p>
      <button className="btn btn-primary" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
