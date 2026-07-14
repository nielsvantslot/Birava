const CACHE_NAME = "birava-v3";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Cache each asset independently: cache.addAll() is all-or-nothing, so a
  // single 404 rejects install and the worker never activates — which on a
  // fresh iOS "Add to Home Screen" leaves serviceWorker.ready hanging forever
  // and push subscription stuck. allSettled keeps install (and push) alive
  // even if an asset is missing.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(STATIC_ASSETS.map((asset) => cache.add(asset))))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
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

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Never cache HTML navigation requests — they are server-rendered and
  // auth-protected. Caching them causes stale/broken pages after session expiry.
  if (event.request.mode === "navigate") return;

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
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached ?? new Response("Offline", { status: 503 }));
    })
  );
});
