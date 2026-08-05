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
