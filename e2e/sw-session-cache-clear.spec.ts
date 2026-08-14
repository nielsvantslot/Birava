import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { TestUserFactory } from "./support/TestUserFactory";

// Regression test for a gap found manually while testing the live app:
// sw.js only cleared its NAV/RSC/MEDIA page caches on a plain POST to
// /api/auth/logout. Every other session boundary — login, signup, and
// account deletion — leaves whatever was cached from the *previous* session
// on this device sitting there, since none of them are a POST to that exact
// URL (login/signup hit /api/auth/login and /api/signup; account deletion
// is a Server Action POST to the current page's own URL). Confirmed live:
// after deleting a throwaway test account and logging back in as a
// different real user, the dashboard's identity-bearing chunk still showed
// the deleted account's username for one paint before self-correcting —
// exactly the class of stale-content bug rsc-revalidate-loop.spec.ts and
// sw-redirect-cache-poisoning.spec.ts already guard other instances of.
//
// Fix: lib/swCache.ts's clearSessionCaches() posts a new CLEAR_SESSION_CACHES
// message, called from login/page.tsx, signup/page.tsx, and
// delete-account-button.tsx right after their respective mutations succeed.
// This test exercises the message handler directly against the real sw.js
// file rather than re-deriving the timing-dependent UI reproduction.
test("CLEAR_SESSION_CACHES message drops every page-content cache", async ({
  page,
  request,
  baseURL,
}) => {
  const credentials = await new TestUserFactory(request, baseURL!).ensure();

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(credentials.email, credentials.password);

  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });

  // Seed all three session-scoped caches with a dummy entry, standing in for
  // whatever a real prior session would have left behind.
  await page.evaluate(async () => {
    const dummy = () => new Response("stale", { status: 200 });
    await Promise.all([
      caches.open("birava-nav-v3").then((c) => c.put("/dashboard", dummy())),
      caches.open("birava-rsc-v3").then((c) => c.put("/dashboard", dummy())),
      caches.open("birava-media-v3").then((c) => c.put("/api/avatars/dummy", dummy())),
    ]);
  });

  const seeded = await page.evaluate(async () => {
    const [nav, rsc, media] = await Promise.all([
      caches.open("birava-nav-v3").then((c) => c.match("/dashboard")),
      caches.open("birava-rsc-v3").then((c) => c.match("/dashboard")),
      caches.open("birava-media-v3").then((c) => c.match("/api/avatars/dummy")),
    ]);
    return { nav: !!nav, rsc: !!rsc, media: !!media };
  });
  expect(seeded).toEqual({ nav: true, rsc: true, media: true });

  await page.evaluate(async () => {
    navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_SESSION_CACHES" });
  });
  await page.waitForTimeout(500);

  const afterClear = await page.evaluate(async () => {
    const names = await caches.keys();
    return {
      navGone: !names.includes("birava-nav-v3"),
      rscGone: !names.includes("birava-rsc-v3"),
      mediaGone: !names.includes("birava-media-v3"),
    };
  });
  expect(afterClear).toEqual({ navGone: true, rscGone: true, mediaGone: true });
});
