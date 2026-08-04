const STATIC_CACHE_NAME = "birava-static-v1";
// A hard navigation requests full HTML; a client-side RSC transition to the
// very same URL requests a structurally different Flight-payload response —
// these MUST live in separate caches, not just under different keys in one
// cache. (An earlier version tried a `#rsc` URL-fragment suffix to keep one
// cache's keys apart; the Cache API ignores fragments entirely when
// matching, so the two shapes silently collided into the same entry and
// browsers ended up rendering raw Flight-protocol text as if it were HTML.)
const NAV_CACHE_NAME = "birava-nav-v1";
const RSC_CACHE_NAME = "birava-rsc-v1";
// Avatars and check-in photos (/api/avatars/*, /api/photos/*) are the one
// auth-gated content that's safe to serve cache-first: each is immutable at
// its URL (an edit swaps in a new one — CLAUDE.md's "Image pipeline"), so
// there's no staleness risk the way there is for a page. Kept separate from
// STATIC_CACHE_NAME so it can be cleared independently on sign-out.
const MEDIA_CACHE_NAME = "birava-media-v1";
const OFFLINE_URL = "/offline";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  OFFLINE_URL,
];
const CURRENT_CACHES = [STATIC_CACHE_NAME, NAV_CACHE_NAME, RSC_CACHE_NAME, MEDIA_CACHE_NAME];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Cache each asset independently: cache.addAll() is all-or-nothing, so a
  // single 404 rejects install and the worker never activates — which on a
  // fresh iOS "Add to Home Screen" leaves serviceWorker.ready hanging forever
  // and push subscription stuck. allSettled keeps install (and push) alive
  // even if an asset is missing.
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => Promise.allSettled(STATIC_ASSETS.map((asset) => cache.add(asset))))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !CURRENT_CACHES.includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Birava", {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: { url: data.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(url));
      return existing ? existing.focus() : self.clients.openWindow(url);
    })
  );
});

// Next's App Router client-side <Link> transitions never do a real browser
// navigation (mode: "navigate") — they fetch just the RSC payload for the
// new route, marked with an `RSC: 1` request header and a `_rsc=<hash>`
// cache-busting query param. Only the very first hard load of a session is
// an actual navigation; everything reached by clicking around afterward is
// this. Missing that meant only the landing page ever got cached.
function isRscRequest(request, url) {
  return request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
}

// The hash in `_rsc` reflects the *current* route's client state, not the
// destination, so the same target page can arrive under different hashes
// depending on where you navigated from — strip it so they all share one
// cache entry instead of colliding into cache misses.
function pageCacheKey(url) {
  const key = new URL(url);
  key.searchParams.delete("_rsc");
  return key.toString();
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons") ||
    url.pathname === "/manifest.webmanifest"
  );
}

function isMediaAsset(url) {
  return url.pathname.startsWith("/api/avatars/") || url.pathname.startsWith("/api/photos/");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") {
    // Not intercepted — the request goes through normally either way. A
    // successful sign-out means whatever's in the nav cache belongs to a
    // session that's now gone; leaving it would let the next person to open
    // this device offline land on the previous user's last-cached page
    // instead of the login screen.
    if (url.pathname === "/api/auth/logout") {
      event.waitUntil(
        fetch(event.request.clone())
          .then((res) => {
            if (res.ok) {
              caches.delete(NAV_CACHE_NAME);
              caches.delete(RSC_CACHE_NAME);
              caches.delete(MEDIA_CACHE_NAME);
            }
          })
          .catch(() => {})
      );
    }
    return;
  }

  // Avatars/photos: cache-first, since these are immutable at their URL —
  // no fetch-first round trip needed the way pages need one for freshness.
  if (isMediaAsset(url)) {
    event.respondWith(
      caches.match(event.request, { cacheName: MEDIA_CACHE_NAME }).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(MEDIA_CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Page content — a real navigation or a client-side RSC transition to some
  // app route — is server-rendered and auth-sensitive, so always prefer a
  // fresh fetch over cache. Only fall back to the last-cached copy of that
  // exact request shape (or the offline page, for a hard navigation to a URL
  // never successfully visited) when the network is actually unavailable.
  const isPageContent =
    !url.pathname.startsWith("/api/") && !isStaticAsset(url) && url.origin === self.location.origin;
  if (isPageContent) {
    const rsc = isRscRequest(event.request, url);
    const cacheName = rsc ? RSC_CACHE_NAME : NAV_CACHE_NAME;
    const cacheKey = pageCacheKey(url);
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(cacheName).then((cache) => cache.put(cacheKey, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(cacheKey, { cacheName });
          if (cached) return cached;
          // No cached copy of this exact shape. A hard navigation can fall
          // back to the offline page; an RSC transition can't — there's no
          // valid Flight-payload substitute — so let the fetch failure
          // propagate and Next's router simply won't complete that
          // client-side transition.
          if (event.request.mode === "navigate") return caches.match(OFFLINE_URL);
          throw new Error("offline, no cached RSC payload for this route");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache only static assets
        if (
          response.ok &&
          (url.pathname.startsWith("/_next/static") ||
            url.pathname.startsWith("/icons") ||
            url.pathname === "/manifest.webmanifest")
        ) {
          const clone = response.clone();
          caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached ?? new Response("Offline", { status: 503 }));
    })
  );
});
