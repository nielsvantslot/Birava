"use client";

/**
 * Tells the service worker to drop its cached copy of `path` (both the RSC
 * and hard-nav shapes — see public/sw.js's NAV_CACHE_NAME/RSC_CACHE_NAME).
 *
 * Necessary before navigating to a list page right after a mutation that
 * changes it (e.g. deleting/leaving a crew, then `router.push`ing back to
 * `/crews`): every RSC-shaped fetch is stale-while-revalidate with no way
 * for the service worker to tell a passive click apart from a post-mutation
 * navigation (public/sw.js's fetch handler comment explains why — that
 * distinction can't be recovered from the request alone, unlike this,
 * which is a one-shot "delete this key" instruction with nothing reacting
 * to it afterwards, so it can't reintroduce the reactive-refresh loop that
 * was removed 2026-08-06). Best-effort: a no-op if there's no active
 * service worker (dev, or before one has taken control yet).
 */
export function invalidateCachedPage(path: string): void {
  navigator.serviceWorker?.controller?.postMessage({
    type: "INVALIDATE_PAGE",
    url: new URL(path, location.origin).toString(),
  });
}
