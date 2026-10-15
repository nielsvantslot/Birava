/// <reference lib="webworker" />
// The service worker. Authored in TypeScript here (sw/) and bundled to
// public/sw.js by `npm run sw:build` (scripts/build-sw.ts); never edit the
// built file. Pure decisions live in RequestClassifier and the cache names in
// CacheNames, both unit tested.
import { CacheNames } from "./CacheNames";
import { RequestClassifier } from "./RequestClassifier";

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", (event: ExtendableEvent) => {
  self.skipWaiting();
  // Cache each asset independently: cache.addAll() is all-or-nothing, so a
  // single 404 rejects install and the worker never activates — which on a
  // fresh iOS "Add to Home Screen" leaves serviceWorker.ready hanging forever
  // and push subscription stuck. allSettled keeps install (and push) alive
  // even if an asset is missing.
  event.waitUntil(
    caches
      .open(CacheNames.STATIC)
      .then((cache) => Promise.allSettled(CacheNames.STATIC_ASSETS.map((asset) => cache.add(asset))))
  );
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !CacheNames.CURRENT.includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Errors thrown inside this scope never reach window.onerror on any page, so
// without forwarding them they'd be invisible to the app's only error
// tracking (components/client-error-reporter.tsx, which POSTs whatever it
// receives to app/api/debug/client-error/route.ts).
function reportSwError(info: Record<string, unknown>) {
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

// Every cached page/RSC entry is keyed by URL alone, with no notion of which
// session wrote it — so whatever's sitting in these caches when one session
// ends (sign-out, account deletion) or a new one begins (login, signup) can
// otherwise leak straight into the next session on this device/browser: the
// stale-while-revalidate hit paints instantly, and nothing re-renders an
// already-painted page once the background revalidate corrects the cache
// (see the RSC branch's comment for why that reactive correction was
// deliberately removed). Shared by both the logout POST branch below and the
// message handler, so every session-boundary trigger clears the same set.
function clearSessionScopedCaches() {
  return Promise.all([
    caches.delete(CacheNames.NAV),
    caches.delete(CacheNames.RSC),
    caches.delete(CacheNames.MEDIA),
  ]);
}

// One-shot cache eviction. Two message shapes:
// - INVALIDATE_PAGES: requested by the client right before navigating to (or
//   refreshing) a page whose data a mutation just changed
//   (lib/swCache.ts's invalidateCachedPages) — driven by the same path list
//   Next's own revalidatePath calls use server-side, not a reactive
//   "something changed, go refresh" signal like the removed postMessage
//   below reacts to, so it can't recreate that loop: nothing responds to
//   this by fetching or messaging again, it just deletes some keys.
// - CLEAR_SESSION_CACHES: requested right after a session boundary that
//   isn't a plain POST to /api/auth/logout (login, signup, account
//   deletion) — see clearSessionScopedCaches's comment. Same one-shot
//   shape: deletes some keys, nothing reacts to it afterwards.
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  const data = event.data;
  if (!data) return;

  if (data.type === "INVALIDATE_PAGES" && Array.isArray(data.urls)) {
    const keys = data.urls.map((u: string) => RequestClassifier.pageCacheKey(u));
    event.waitUntil(
      Promise.all([
        caches.open(CacheNames.RSC).then((cache) => Promise.all(keys.map((key: string) => cache.delete(key)))),
        caches.open(CacheNames.NAV).then((cache) => Promise.all(keys.map((key: string) => cache.delete(key)))),
      ])
    );
    return;
  }

  if (data.type === "CLEAR_SESSION_CACHES") {
    event.waitUntil(clearSessionScopedCaches());
  }
});

self.addEventListener("push", (event: PushEvent) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Birava", {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: { url: data.url || "/dashboard", notificationId: data.id },
    })
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  const notificationId = event.notification.data?.notificationId;
  event.waitUntil(
    Promise.all([
      // Best-effort — a failed report should never block opening the app.
      // Same-origin fetch carries the birava_session cookie automatically.
      notificationId
        ? fetch(`/api/notifications/${notificationId}/opened`, { method: "POST" }).catch(() => {})
        : Promise.resolve(),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
        const existing = clientsArr.find((c) => c.url.includes(url));
        return existing ? existing.focus() : self.clients.openWindow(url);
      }),
    ])
  );
});

self.addEventListener("fetch", (event: FetchEvent) => {
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
          .then((res) => (res.ok ? clearSessionScopedCaches() : undefined))
          .catch(() => {})
      );
    }
    return;
  }

  // Avatars/photos: cache-first, since these are immutable at their URL —
  // no fetch-first round trip needed the way pages need one for freshness.
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

  // Page content — a real navigation or a client-side RSC transition to some
  // app route — is server-rendered and auth-sensitive.
  const isPageContent =
    RequestClassifier.isPageContent(url, self.location.origin);
  if (isPageContent) {
    const rsc = RequestClassifier.isRscRequest(event.request.headers, url);
    const cacheKey = RequestClassifier.pageCacheKey(url);

    if (rsc) {
      // Client-side <Link> transitions: stale-while-revalidate, not
      // network-first. A cache hit paints the destination instantly instead
      // of blocking every single click on a round trip — the real fetch
      // still runs in the background and updates the cache for next time.
      //
      // There used to also be a postMessage telling any open tab to
      // router.refresh() once the background fetch landed, so stale
      // auth/social state (own-vs-others' accent, cheer/comment counts)
      // self-corrected within moments. That was removed (2026-08-06) because
      // it was fundamentally unsound, not just buggy: router.refresh() sends
      // the exact same RSC-shaped fetch a real <Link> transition does, so
      // this SW has no way to tell them apart, meaning every refresh()
      // landed right back here, found a cache hit, and its own background
      // fetch becoming the trigger for the *next* refresh() — a
      // self-sustaining loop with no natural exit. An attempted fix that
      // only notified when the response body actually changed didn't work
      // either: fetching this exact endpoint twice in a row, zero data
      // changes, still differs — Next embeds a fresh random key + timestamp
      // into its internal metadata/viewport streaming boundaries on every
      // single render, so two Flight payloads for the same route are never
      // guaranteed byte-identical no matter what. That comparison always
      // found "different" and always notified anyway; it only reduced the
      // loop's cycle rate (reading two ~80KB bodies as text on every fetch)
      // enough to drop under Safari's history.replaceState() rate limit
      // (100 calls/10s, tripped once per cycle by Next's router-sync
      // effect) — no more SecurityError crash, but the page kept silently
      // re-rendering forever. The only fix that actually terminates the
      // loop is not having anything react to "a revalidation happened" by
      // calling refresh() again — see sw-revalidate-listener.tsx, which now
      // only refreshes once, unconditionally, on mount. The tradeoff: a
      // cold-start paint that happens to hit a stale cache entry stays
      // stale for that page view instead of self-correcting a few moments
      // later — acceptable, since the loop this replaced caused a
      // production crash on iOS Safari and silent-forever reloading
      // everywhere else.
      event.respondWith(
        caches.match(cacheKey, { cacheName: CacheNames.RSC }).then((cached) => {
          const revalidate = fetch(event.request)
            .then((response) => {
              // fetch() follows redirects transparently — an unauthenticated
              // request for a protected route (or an authenticated request
              // for /login|/signup) comes back here as response.ok with a
              // *different* page's Flight payload as the body. Caching that
              // under this request's own URL would silently serve the wrong
              // page's content on a later visit to this URL, regardless of
              // auth state at that later time — confirmed live: an
              // authenticated RSC fetch for /login (auto-redirected by
              // middleware to /dashboard) had cached the dashboard's payload
              // under the /login key, so a logged-out visitor's next
              // client-side navigation to /login would have rendered the
              // dashboard instead of the sign-in form.
              if (response.ok && !response.redirected) {
                const clone = response.clone();
                caches.open(CacheNames.RSC).then((cache) => cache.put(cacheKey, clone));
              }
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
      caches.match(cacheKey, { cacheName: CacheNames.NAV }).then((cached) => {
        const revalidate = fetch(event.request)
          .then((response) => {
            // Same reasoning as the RSC branch above: a followed redirect
            // (e.g. an expired-session hard reload of a protected page
            // bouncing to /login) must never be cached under the
            // pre-redirect URL.
            if (response.ok && !response.redirected) {
              const clone = response.clone();
              caches.open(CacheNames.NAV).then((cache) => cache.put(cacheKey, clone));
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
        return revalidate.then((response) => response ?? (caches.match(CacheNames.OFFLINE_URL) as Promise<Response>));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache only static assets
        if (response.ok && RequestClassifier.isStaticAsset(url)) {
          const clone = response.clone();
          caches.open(CacheNames.STATIC).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached ?? new Response("Offline", { status: 503 }));
    })
  );
});
