import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { TestUserFactory } from "./support/TestUserFactory";

// Regression test for a cache-poisoning bug found manually while testing the
// live app: public/sw.js's stale-while-revalidate strategy for page content
// (both the RSC branch and the hard-navigation branch) cached every
// successful fetch() response under the *requested* URL, without checking
// whether that fetch had actually been redirected first. fetch() follows
// redirects transparently, so an authenticated client-side transition to
// /login (middleware bounces an authenticated visitor straight to
// /dashboard — lib/auth/proxy-session.ts's isAuthPage branch) resulted in
// the *dashboard's* Flight payload getting cached under the /login cache
// key. Confirmed live: a later, logged-out visit to /login served that
// stale dashboard payload instead of the sign-in form. The same mechanism
// runs in reverse for a protected route fetched while logged out (or after
// a session just expired) — its cache entry becomes whatever /login's
// content was, so a *fresh, successful* login's very next client-side
// navigation to that route can render the sign-in form under e.g. the
// /dashboard URL, exactly what a real user reported in production.
//
// The fix (response.ok && !response.redirected before cache.put) is
// intentionally minimal and doesn't touch the postMessage/refresh-signal
// code path that caused the separate infinite-loop regression covered by
// rsc-revalidate-loop.spec.ts — that history is why this is a narrow,
// direct test of the caching decision itself rather than another
// timing-dependent UI reproduction.
test("a redirected fetch is never cached under its pre-redirect URL", async ({
  page,
  request,
  baseURL,
}) => {
  const credentials = await new TestUserFactory(request, baseURL!).ensure();

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(credentials.email, credentials.password);

  // Same rationale as rsc-revalidate-loop.spec.ts: sw.js is only
  // auto-registered in production, so it's registered directly here to
  // exercise the real file's fetch handler.
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });

  // Mimic the RSC fetch a real <Link href="/login"> client-side transition
  // would send while already authenticated — middleware redirects this to
  // /dashboard, and fetch() follows it transparently.
  const redirectedResult = await page.evaluate(async () => {
    const res = await fetch("/login", { headers: { RSC: "1" } });
    return { ok: res.ok, redirected: res.redirected, finalUrl: res.url };
  });
  expect(redirectedResult.redirected).toBe(true);
  expect(redirectedResult.finalUrl).toContain("/dashboard");

  // Give the SW's background cache.put a moment to settle before checking.
  await page.waitForTimeout(500);

  const loginCacheEntry = await page.evaluate(async () => {
    const cache = await caches.open("birava-rsc-v3");
    const match = await cache.match("/login");
    return match ? await match.text() : null;
  });
  expect(loginCacheEntry).toBeNull();

  // Sanity check: a normal, non-redirected RSC fetch for a route the user
  // actually has access to still gets cached as before — the fix must not
  // have disabled caching altogether.
  await page.evaluate(async () => {
    await fetch("/dashboard", { headers: { RSC: "1" } });
  });
  await page.waitForTimeout(500);

  const dashboardCacheEntry = await page.evaluate(async () => {
    const cache = await caches.open("birava-rsc-v3");
    const match = await cache.match("/dashboard");
    return match ? true : false;
  });
  expect(dashboardCacheEntry).toBe(true);
});
