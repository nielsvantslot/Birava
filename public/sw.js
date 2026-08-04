const STATIC_CACHE_NAME = "birava-static-v1";
const NAV_CACHE_NAME = "birava-nav-v1";
const OFFLINE_URL = "/offline";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  OFFLINE_URL,
];
const CURRENT_CACHES = [STATIC_CACHE_NAME, NAV_CACHE_NAME];

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
            if (res.ok) caches.delete(NAV_CACHE_NAME);
          })
          .catch(() => {})
      );
    }
    return;
  }

  // Page navigations: server-rendered and auth-sensitive, so always prefer
  // a fresh fetch over cache. Only fall back to the last-cached copy of that
  // exact URL (or the offline page, for a URL never successfully visited)
  // when the network is actually unavailable.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(NAV_CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request, { cacheName: NAV_CACHE_NAME });
          return cached ?? (await caches.match(OFFLINE_URL));
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
