// GENERATED from sw/ by `npm run sw:build`. Edit sw/sw.ts, not this file.

"use strict";
(() => {
  // sw/CacheNames.ts
  var _CacheNames = class _CacheNames {
  };
  _CacheNames.VERSION = "v3";
  _CacheNames.STATIC = `birava-static-${_CacheNames.VERSION}`;
  // A hard navigation requests full HTML; a client-side RSC transition to the
  // very same URL requests a structurally different Flight-payload response —
  // these MUST live in separate caches, not just under different keys in one
  // cache. (An earlier version tried a `#rsc` URL-fragment suffix to keep one
  // cache's keys apart; the Cache API ignores fragments entirely when
  // matching, so the two shapes silently collided into the same entry and
  // browsers ended up rendering raw Flight-protocol text as if it were HTML.)
  _CacheNames.NAV = `birava-nav-${_CacheNames.VERSION}`;
  _CacheNames.RSC = `birava-rsc-${_CacheNames.VERSION}`;
  // Avatars and check-in photos (/api/avatars/*, /api/photos/*) are the one
  // auth-gated content that's safe to serve cache-first: each is immutable at
  // its URL (an edit swaps in a new one — CLAUDE.md's "Image pipeline"), so
  // there's no staleness risk the way there is for a page. Kept separate from
  // STATIC so it can be cleared independently on sign-out.
  _CacheNames.MEDIA = `birava-media-${_CacheNames.VERSION}`;
  _CacheNames.OFFLINE_URL = "/offline";
  _CacheNames.STATIC_ASSETS = ["/manifest.webmanifest", "/icons/icon-192x192.png", "/icons/icon-512x512.png", _CacheNames.OFFLINE_URL];
  _CacheNames.CURRENT = [_CacheNames.STATIC, _CacheNames.NAV, _CacheNames.RSC, _CacheNames.MEDIA];
  var CacheNames = _CacheNames;

  // sw/RequestClassifier.ts
  var RequestClassifier = class _RequestClassifier {
    /**
     * Next's App Router client-side <Link> transitions never do a real browser
     * navigation (mode: "navigate") — they fetch just the RSC payload for the
     * new route, marked with an `RSC: 1` request header and a `_rsc=<hash>`
     * cache-busting query param. Only the very first hard load of a session is
     * an actual navigation; everything reached by clicking around afterward is
     * this. Missing that meant only the landing page ever got cached.
     */
    static isRscRequest(headers, url) {
      return headers.get("RSC") === "1" || url.searchParams.has("_rsc");
    }
    /**
     * The hash in `_rsc` reflects the *current* route's client state, not the
     * destination, so the same target page can arrive under different hashes
     * depending on where you navigated from — strip it so they all share one
     * cache entry instead of colliding into cache misses.
     */
    static pageCacheKey(url) {
      const key = new URL(url);
      key.searchParams.delete("_rsc");
      return key.toString();
    }
    static isStaticAsset(url) {
      return url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons") || url.pathname === "/manifest.webmanifest";
    }
    static isMediaAsset(url) {
      return url.pathname.startsWith("/api/avatars/") || url.pathname.startsWith("/api/photos/");
    }
    /** A real navigation or client-side RSC transition to an app route: server-rendered and auth-sensitive. */
    static isPageContent(url, ownOrigin) {
      return !url.pathname.startsWith("/api/") && !_RequestClassifier.isStaticAsset(url) && url.origin === ownOrigin;
    }
  };

  // sw/sw.ts
  self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil(
      caches.open(CacheNames.STATIC).then((cache) => Promise.allSettled(CacheNames.STATIC_ASSETS.map((asset) => cache.add(asset))))
    );
  });
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches.keys().then(
        (keys) => Promise.all(keys.filter((k) => !CacheNames.CURRENT.includes(k)).map((k) => caches.delete(k)))
      )
    );
    self.clients.claim();
  });
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
      stack: event.error?.stack
    });
  });
  self.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reportSwError({
      source: "unhandledrejection",
      message: reason?.message ?? String(reason),
      stack: reason?.stack
    });
  });
  function clearSessionScopedCaches() {
    return Promise.all([
      caches.delete(CacheNames.NAV),
      caches.delete(CacheNames.RSC),
      caches.delete(CacheNames.MEDIA)
    ]);
  }
  self.addEventListener("message", (event) => {
    const data = event.data;
    if (!data) return;
    if (data.type === "INVALIDATE_PAGES" && Array.isArray(data.urls)) {
      const keys = data.urls.map((u) => RequestClassifier.pageCacheKey(u));
      event.waitUntil(
        Promise.all([
          caches.open(CacheNames.RSC).then((cache) => Promise.all(keys.map((key) => cache.delete(key)))),
          caches.open(CacheNames.NAV).then((cache) => Promise.all(keys.map((key) => cache.delete(key))))
        ])
      );
      return;
    }
    if (data.type === "CLEAR_SESSION_CACHES") {
      event.waitUntil(clearSessionScopedCaches());
    }
  });
  self.addEventListener("push", (event) => {
    const data = event.data ? event.data.json() : {};
    event.waitUntil(
      self.registration.showNotification(data.title || "Birava", {
        body: data.body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        data: { url: data.url || "/dashboard", notificationId: data.id }
      })
    );
  });
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification.data?.url || "/dashboard";
    const notificationId = event.notification.data?.notificationId;
    event.waitUntil(
      Promise.all([
        // Best-effort — a failed report should never block opening the app.
        // Same-origin fetch carries the birava_session cookie automatically.
        notificationId ? fetch(`/api/notifications/${notificationId}/opened`, { method: "POST" }).catch(() => {
        }) : Promise.resolve(),
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
          const existing = clientsArr.find((c) => c.url.includes(url));
          return existing ? existing.focus() : self.clients.openWindow(url);
        })
      ])
    );
  });
  self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== "GET") {
      if (url.pathname === "/api/auth/logout") {
        event.waitUntil(
          fetch(event.request.clone()).then((res) => res.ok ? clearSessionScopedCaches() : void 0).catch(() => {
          })
        );
      }
      return;
    }
    if (RequestClassifier.isMediaAsset(url)) {
      event.respondWith(
        caches.match(event.request, { cacheName: CacheNames.MEDIA }).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CacheNames.MEDIA).then((cache) => cache.put(event.request, clone));
            }
            return response;
          });
        })
      );
      return;
    }
    const isPageContent = RequestClassifier.isPageContent(url, self.location.origin);
    if (isPageContent) {
      const rsc = RequestClassifier.isRscRequest(event.request.headers, url);
      const cacheKey = RequestClassifier.pageCacheKey(url);
      if (rsc) {
        event.respondWith(
          caches.match(cacheKey, { cacheName: CacheNames.RSC }).then((cached) => {
            const revalidate = fetch(event.request).then((response) => {
              if (response.ok && !response.redirected) {
                const clone = response.clone();
                caches.open(CacheNames.RSC).then((cache) => cache.put(cacheKey, clone));
              }
              return response;
            }).catch(() => null);
            if (cached) {
              event.waitUntil(revalidate);
              return cached;
            }
            return revalidate.then((response) => {
              if (response) return response;
              throw new Error("offline, no cached RSC payload for this route");
            });
          })
        );
        return;
      }
      event.respondWith(
        caches.match(cacheKey, { cacheName: CacheNames.NAV }).then((cached) => {
          const revalidate = fetch(event.request).then((response) => {
            if (response.ok && !response.redirected) {
              const clone = response.clone();
              caches.open(CacheNames.NAV).then((cache) => cache.put(cacheKey, clone));
            }
            return response;
          }).catch(() => null);
          if (cached) {
            event.waitUntil(revalidate);
            return cached;
          }
          return revalidate.then((response) => response ?? caches.match(CacheNames.OFFLINE_URL));
        })
      );
      return;
    }
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok && RequestClassifier.isStaticAsset(url)) {
            const clone = response.clone();
            caches.open(CacheNames.STATIC).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached ?? new Response("Offline", { status: 503 }));
      })
    );
  });
})();
