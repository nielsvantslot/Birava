"use client";

import { useEffect } from "react";
import { ControllerChangeReloadGate } from "@/lib/swControllerReload";

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

    // See ControllerChangeReloadGate's own comment for the full "why": in
    // short, sw.js's skipWaiting()+clients.claim() combination hands this tab
    // to a new SW mid-session with no navigation involved, so without this,
    // an already-open tab keeps running its old JS bundle while every
    // subsequent request goes through a different SW/cache generation. This
    // is a one-time hard `location.reload()` (a real navigation, through
    // sw.js's NAV_CACHE_NAME branch), not the reactive
    // router.refresh()-on-SW-message pattern that caused the iOS Safari crash
    // loop this app already fixed (see sw.js's RSC branch comment) — that
    // loop depended on refresh() sending the exact same RSC-shaped fetch this
    // SW's own revalidation responds to, so its own background fetch became
    // the next trigger; a hard reload doesn't feed back into anything, and
    // the gate only ever returns true once regardless.
    const reloadGate = new ControllerChangeReloadGate(Boolean(navigator.serviceWorker.controller));
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadGate.onControllerChange()) window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // The browser's own update check is real but passively scheduled
        // (throttled, roughly once/day) — a user who opens the app daily
        // could otherwise sit on a stale SW/cache for a long time even after
        // a fix ships (see sw.js's CACHE_VERSION comment for the incident
        // this traces back to). Forcing a check on every foreground/visit,
        // combined with the controllerchange reload above, collapses how
        // long "stale" can last from up to a day to effectively one visit —
        // and the moment a new SW does take over, it now actually reaches the
        // screen instead of silently waiting for some later navigation.
        registration.update().catch(() => {});
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") registration.update().catch(() => {});
        });
      })
      .catch((err) => console.error("SW registration failed:", err));
  }, []);

  return null;
}
