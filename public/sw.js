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

// Errors thrown inside this scope never reach window.onerror on any page, so
// without forwarding them they'd be invisible to the app's only error
// tracking (components/client-error-reporter.tsx, which POSTs whatever it
// receives to app/api/debug/client-error/route.ts).
function reportSwError(info) {
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
    clientsArr.forEach((client) => client.postMessage({ type: "SW_ERROR", ...info }));
  });
}
self.addEventListener("error", (event) => {
  reportSwError({
    source: "error",
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    stack: event.error?.stack,
  });
});
self.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  reportSwError({
    source: "unhandledrejection",
    message: reason?.message ?? String(reason),
    stack: reason?.stack,
  });
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

// Tells any open tab that a route it may currently be showing a cached
// RSC payload for has just been re-fetched — see sw-revalidate-listener.tsx,
// which router.refresh()es only if that tab's current URL matches.
function notifyClientsOfRevalidation(pageUrl) {
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
    clientsArr.forEach((client) => client.postMessage({ type: "RSC_REVALIDATED", url: pageUrl }));
  });
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
  // app route — is server-rendered and auth-sensitive.
  const isPageContent =
    !url.pathname.startsWith("/api/") && !isStaticAsset(url) && url.origin === self.location.origin;
  if (isPageContent) {
    const rsc = isRscRequest(event.request, url);
    const cacheKey = pageCacheKey(url);

    if (rsc) {
      // Client-side <Link> transitions: stale-while-revalidate, not
      // network-first. A cache hit paints the destination instantly instead
      // of blocking every single click on a round trip — the real fetch
      // still runs in the background, and if it comes back different, the
      // open tab is told to router.refresh() (see sw-revalidate-listener.tsx)
      // so any auth/social state (own-vs-others' accent, cheer/comment
      // counts) self-corrects within moments rather than staying stale until
      // the next navigation. A hard navigation can't safely do this — there
      // is no way to swap a document's content after it's already rendered
      // without a reload — so it stays network-first below.
      event.respondWith(
        caches.match(cacheKey, { cacheName: RSC_CACHE_NAME }).then((cached) => {
          const revalidate = fetch(event.request)
            .then(async (response) => {
              if (!response.ok) return response;
              const forCache = response.clone();
              // router.refresh() (sw-revalidate-listener.tsx) sends the exact
              // same RSC-shaped fetch a real <Link> transition would — this
              // SW has no way to tell them apart. Without this comparison,
              // every refresh() lands here, always finds a cache hit, and
              // once its background fetch resolves it unconditionally
              // notified below — which made the listener call refresh()
              // again, landing right back here: a self-sustaining loop with
              // no exit condition, bounded only by network round-trip time.
              // Fast enough connections cycled it 10+ times/second, which
              // was enough to blow through Safari's built-in
              // history.replaceState() rate limit (100 calls/10s, tripped by
              // Next's router-sync effect running once per cycle) and crash
              // the page with a SecurityError — this is the "client-side
              // exception" ClientErrorLog was built to catch. Only notify
              // when the content actually changed, so a refresh whose fetch
              // turns out identical to what's already cached — which is what
              // every one of this loop's later cycles was — has nothing left
              // to correct and the chain stops on its own.
              if (cached) {
                const [cachedText, freshText] = await Promise.all([
                  cached.clone().text(),
                  response.clone().text(),
                ]);
                if (cachedText !== freshText) {
                  notifyClientsOfRevalidation(cacheKey);
                }
              }
              caches.open(RSC_CACHE_NAME).then((cache) => cache.put(cacheKey, forCache));
              return response;
            })
            .catch(() => null);

          if (cached) {
            event.waitUntil(revalidate);
            return cached;
          }
          // No cached copy yet — a genuinely first visit to this route, so
          // there's nothing to paint early. There's also no valid
          // Flight-payload substitute to fall back to, so a network failure
          // here has to propagate — Next's router simply won't complete
          // that client-side transition.
          return revalidate.then((response) => {
            if (response) return response;
            throw new Error("offline, no cached RSC payload for this route");
          });
        })
      );
      return;
    }

    // Hard navigation: full server-rendered HTML. This is the PWA's entry
    // point — every cold app launch is one of these — so it gets the same
    // stale-while-revalidate treatment as the RSC branch above: a cache hit
    // (typically the app's own start_url) paints instantly instead of
    // blocking launch on a round trip, while the real fetch still updates
    // the cache in the background. There's no postMessage correction here
    // like the RSC branch — instead, SwRevalidateListener unconditionally
    // calls router.refresh() once on mount, since that component only
    // remounts on a hard navigation, so there's no message-timing race to
    // worry about between paint and hydration.
    event.respondWith(
      caches.match(cacheKey, { cacheName: NAV_CACHE_NAME }).then((cached) => {
        const revalidate = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(NAV_CACHE_NAME).then((cache) => cache.put(cacheKey, clone));
            }
            return response;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(revalidate);
          return cached;
        }
        // No cached copy of this URL yet — nothing to paint early, so fall
        // through to the network exactly as before, with /offline as the
        // last resort if that fails too.
        return revalidate.then((response) => response ?? caches.match(OFFLINE_URL));
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
