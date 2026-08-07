"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // The SW serves /_next/static cache-first. In development chunk URLs are
    // not content-hashed, so a registered SW keeps serving stale code across
    // reloads and even server restarts. Register in production only, and
    // clean up any previously registered SW (+ its caches) in development —
    // unless NEXT_PUBLIC_FORCE_SW_IN_DEV opts in. That's for testing the SW
    // itself locally (e.g. reproducing e2e/rsc-revalidate-loop.spec.ts's bug
    // class by hand) without a full production build or a staging deploy
    // round-trip — see .env.example. Opt-in, not default: it reintroduces
    // the stale-chunk risk this guard exists to avoid, so leave it unset for
    // normal day-to-day dev work.
    if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_FORCE_SW_IN_DEV) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((r) => r.unregister()))
        )
        .then(() => caches.keys())
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.error("SW registration failed:", err));
  }, []);

  return null;
}
