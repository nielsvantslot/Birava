"use client";

/**
 * Tells the service worker to drop its cached copy of each path (both the
 * RSC and hard-nav shapes — see public/sw.js's NAV_CACHE_NAME/RSC_CACHE_NAME).
 *
 * Necessary before navigating to (or refreshing) a page right after a
 * mutation that changes what it shows: every RSC-shaped fetch is
 * stale-while-revalidate with no way for the service worker to tell a
 * passive click apart from a post-mutation navigation (public/sw.js's fetch
 * handler comment explains why — that distinction can't be recovered from
 * the request alone). This is a one-shot "delete these keys" instruction
 * with nothing reacting to it afterwards, so it can't reintroduce the
 * reactive-refresh loop that was removed 2026-08-06.
 *
 * `paths` should be exactly the list a mutation's result says it revalidated
 * server-side (ActionResultDTO.revalidatedPaths et al.) — driven by the same
 * source Next's own revalidatePath calls use, not a separately-maintained
 * guess, so it can't drift out of sync the way a handwritten path list can.
 * Best-effort: a no-op if there's no active service worker (dev, or before
 * one has taken control yet).
 */
export function invalidateCachedPages(paths: string[]): void {
  const controller = navigator.serviceWorker?.controller;
  if (!controller || paths.length === 0) return;
  controller.postMessage({
    type: "INVALIDATE_PAGES",
    urls: paths.map((path) => new URL(path, location.origin).toString()),
  });
}

/**
 * Tells the service worker to drop every cached page/RSC/media entry —
 * every one of them is keyed by URL alone with no notion of which session
 * wrote it, so whatever's cached from a session that just ended (or hasn't
 * started yet) can otherwise leak straight into the next one on this
 * device/browser. public/sw.js already does this on its own for a plain
 * POST to /api/auth/logout; call this explicitly right after any other
 * session boundary — a successful login, signup, or account-deletion
 * request — since those don't go through that exact endpoint (login/signup
 * hit /api/auth/login and /api/signup; account deletion is a Server Action
 * POST to the current page's own URL, not a fixed route the service worker
 * could pattern-match on). Best-effort: a no-op if there's no active
 * service worker (dev, or before one has taken control yet).
 */
export function clearSessionCaches(): void {
  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_SESSION_CACHES" });
}
