"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// public/sw.js serves both hard navigations and client-side RSC transitions
// stale-while-revalidate: a cached route paints instantly while the real
// fetch runs in the background to refresh the cache for next time. This
// component's only job is a single router.refresh() on mount, to reconcile
// this page's initial paint with live data shortly after a cold-start hit on
// a stale cache entry (own-vs-others' accent, cheer/comment counts).
//
// There used to also be a postMessage-driven second refresh — sw.js posted a
// message once its background fetch landed, and this listened for it and
// called router.refresh() again if the tab was still on that route. Removed
// (2026-08-06): router.refresh() sends the exact same RSC-shaped fetch a
// real <Link> transition does, so sw.js has no way to tell them apart, which
// meant every refresh's own background fetch became the trigger for the
// *next* refresh — an infinite loop with no natural exit, fast enough to
// blow through Safari's history.replaceState() rate limit and crash the
// page (and, on browsers without that limit, just reload forever silently).
// See sw.js's RSC branch for the full writeup, including why comparing the
// response body couldn't fix it either. The one remaining refresh below
// can't loop: it's a fixed effect that fires once per mount, not a reaction
// to anything sw.js sends back.
export function SwRevalidateListener() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // This component lives in the root layout, which only remounts on a
    // hard navigation (a client-side <Link> transition never re-runs it) —
    // so this fires exactly once per app launch.
    router.refresh();
  }, [router]);

  return null;
}
