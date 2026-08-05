"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// public/sw.js serves client-side RSC transitions stale-while-revalidate:
// a cached route paints instantly, then the real fetch runs in the
// background and posts a message here once it lands. If the tab is still
// sitting on that exact route, router.refresh() re-fetches the RSC payload
// and re-renders with fresh data — correcting any staleness (own-vs-others'
// accent, cheer/comment counts) within moments instead of leaving it stale
// until the next navigation.
export function SwRevalidateListener() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // This component lives in the root layout, which only remounts on a
    // hard navigation (a client-side <Link> transition never re-runs it) —
    // so this fires exactly once per app launch. The initial paint may have
    // come from sw.js's NAV_CACHE_NAME on a cache hit; refreshing once here
    // reconciles with live data shortly after, the hard-navigation
    // equivalent of the RSC branch's postMessage correction below.
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== "RSC_REVALIDATED") return;
      const updatedUrl = new URL(event.data.url, window.location.origin);
      if (updatedUrl.pathname === window.location.pathname) {
        router.refresh();
      }
    }

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [router]);

  return null;
}
