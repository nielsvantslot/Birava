"use client";

import { useEffect } from "react";

// The app's only error-tracking mechanism — no Sentry/Bugsnag/etc. is wired
// up, so this is how a crash in the field (originally: an iOS Safari-only
// "client-side exception" no one could get a stack trace for, since remote
// Safari debugging needs a Mac) becomes visible at all. Covers both
// page-level errors and errors thrown inside sw.js itself (forwarded via
// postMessage, since the service worker's global scope has no window to
// report to directly). Persisted via app/api/debug/client-error/route.ts →
// lib/commands/clientErrorLogCommands.ts's ClientErrorLog table.
export function ClientErrorReporter() {
  useEffect(() => {
    function report(payload: Record<string, unknown>) {
      fetch("/api/debug/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
          time: new Date().toISOString(),
        }),
        keepalive: true,
      }).catch(() => {});
    }

    function onError(event: ErrorEvent) {
      report({
        source: "window.onerror",
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason: unknown = event.reason;
      const reasonObj = reason as { message?: string; stack?: string } | undefined;
      report({
        source: "unhandledrejection",
        message: reasonObj?.message ?? String(reason),
        stack: reasonObj?.stack,
      });
    }

    function onSwMessage(event: MessageEvent) {
      if (event.data?.type !== "SW_ERROR") return;
      report({ source: `sw:${event.data.source}`, ...event.data });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, []);

  return null;
}
