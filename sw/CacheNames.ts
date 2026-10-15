/**
 * The service worker's caches. Bump CACHE_VERSION on a deploy that needs to
 * force-evict stale cached pages/bundles — every version bump changes the
 * built file's own bytes, which makes the browser install it as a new worker
 * (skipWaiting() activates it immediately) and its activate handler deletes
 * every cache name not in `current`. Without this, the nav cache's
 * stale-while-revalidate strategy (see the fetch handler) has no natural
 * expiry: a user can reload the exact same stale HTML+JS bundle forever,
 * since a cache hit always wins over the background revalidation update on
 * that same load, and nothing else ever tells the browser this worker's own
 * cache contents are outdated (confirmed live 2026-08-08: a shipped bugfix
 * never reached an active tab through any number of plain reloads or even
 * hard-refreshes, since neither bypasses this worker's own Cache Storage, only
 * the browser's separate HTTP cache).
 */
export class CacheNames {
  static readonly VERSION = "v3";
  static readonly STATIC = `birava-static-${CacheNames.VERSION}`;
  // A hard navigation requests full HTML; a client-side RSC transition to the
  // very same URL requests a structurally different Flight-payload response —
  // these MUST live in separate caches, not just under different keys in one
  // cache. (An earlier version tried a `#rsc` URL-fragment suffix to keep one
  // cache's keys apart; the Cache API ignores fragments entirely when
  // matching, so the two shapes silently collided into the same entry and
  // browsers ended up rendering raw Flight-protocol text as if it were HTML.)
  static readonly NAV = `birava-nav-${CacheNames.VERSION}`;
  static readonly RSC = `birava-rsc-${CacheNames.VERSION}`;
  // Avatars and check-in photos (/api/avatars/*, /api/photos/*) are the one
  // auth-gated content that's safe to serve cache-first: each is immutable at
  // its URL (an edit swaps in a new one — CLAUDE.md's "Image pipeline"), so
  // there's no staleness risk the way there is for a page. Kept separate from
  // STATIC so it can be cleared independently on sign-out.
  static readonly MEDIA = `birava-media-${CacheNames.VERSION}`;
  static readonly OFFLINE_URL = "/offline";
  static readonly STATIC_ASSETS = ["/manifest.webmanifest", "/icons/icon-192x192.png", "/icons/icon-512x512.png", CacheNames.OFFLINE_URL];
  static readonly CURRENT = [CacheNames.STATIC, CacheNames.NAV, CacheNames.RSC, CacheNames.MEDIA];
}
