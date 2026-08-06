import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { TestUserFactory } from "./support/TestUserFactory";

// Regression test for the infinite RSC-revalidate/refresh loop that crashed
// iOS Safari in production. public/sw.js's RSC branch used to notify every
// open tab whenever a background revalidation landed, and
// sw-revalidate-listener.tsx reacted by calling router.refresh() again —
// but that refresh sends the exact same RSC-shaped fetch a real <Link>
// transition does, so its own background revalidation re-triggered the same
// notification, forever. Fast enough to spam history.replaceState() past
// Safari's built-in 100-calls/10s throttle and crash the page; see both
// files' comments for the full writeup, including why a "only notify if the
// content changed" fix didn't work either (Next's Flight payloads embed a
// fresh random key on every render, so two fetches of the same route are
// never byte-identical).
//
// Runs under both chromium and webkit (playwright.config.ts): webkit is the
// one that would actually throw a SecurityError if this regresses, since
// it's real Apple WebKit and enforces that rate limit; chromium has no such
// throttle, so it only catches the runaway replaceState count directly.
test("repeated navigation across the same routes doesn't spam history.replaceState", async ({
  page,
  request,
  baseURL,
}) => {
  const credentials = await new TestUserFactory(request, baseURL!).ensure();

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // sessionStorage, not a window property — the count must survive a hard
  // navigation (a fresh addInitScript run) since a runaway loop could in
  // principle manifest as repeated full reloads, not just soft refreshes.
  await page.addInitScript(() => {
    const key = "__e2e_replaceStateCount";
    if (sessionStorage.getItem(key) === null) sessionStorage.setItem(key, "0");
    const original = window.history.replaceState.bind(window.history);
    window.history.replaceState = function (...args: Parameters<typeof original>) {
      sessionStorage.setItem(key, String(Number(sessionStorage.getItem(key)) + 1));
      return original(...args);
    };
  });

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(credentials.email, credentials.password);

  // components/service-worker-registration.tsx deliberately never registers
  // sw.js outside NODE_ENV=production (stale dev chunk caching — see its own
  // comment), and this suite runs against `next dev` (photo uploads need
  // local-disk storage, which only NODE_ENV=development gets). Registering
  // it directly here, bypassing that app-level gate, is the only way to
  // exercise the real sw.js file's behavior at all in this harness.
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    if (registration.active && !navigator.serviceWorker.controller) {
      // clients.claim() (sw.js's activate handler) should pick up this
      // already-open page without a reload, but give it a beat.
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  });

  // href-scoped to components/layout/sidebar-nav.tsx's <nav
  // className="sidebar-nav"> specifically: role/name matching is unreliable
  // here since the sidebar's labels are icon-only (no accessible text) below
  // the xl breakpoint, the dashboard's own "You" feed-tab toggle
  // (?tab=you) collides with the sidebar's /profile link by name, and the
  // "Birava home" brand logo shares /dashboard's href with the sidebar's own
  // Home item.
  const sidebar = page.locator("nav.sidebar-nav");

  // The exact sequence reported: profile -> stats -> profile -> dashboard,
  // repeated — the original bug depended on revisiting an already-cached
  // route to hit the SW's cache-hit-then-revalidate path.
  // The loop this guards against only sustains itself if the tab is still
  // sitting on a revisited route when the background revalidation's message
  // would have landed — a quick dwell after each click matches that
  // (real usage: scrolling a feed, reading a page) rather than racing away
  // fast enough to accidentally dodge it.
  for (let i = 0; i < 3; i++) {
    await sidebar.locator('a[href="/profile"]').click();
    await page.waitForURL(/\/profile/);
    await page.waitForTimeout(800);
    await sidebar.locator('a[href="/stats"]').click();
    await page.waitForURL(/\/stats/);
    await page.waitForTimeout(800);
    await sidebar.locator('a[href="/profile"]').click();
    await page.waitForURL(/\/profile/);
    await page.waitForTimeout(800);
    await sidebar.locator('a[href="/dashboard"]').click();
    await page.waitForURL(/\/dashboard/);
    await page.waitForTimeout(800);
  }

  // Give any lingering async revalidate/refresh cycle a moment to run its
  // course before reading the final count.
  await page.waitForTimeout(3000);

  const replaceStateCount = await page.evaluate(() =>
    Number(sessionStorage.getItem("__e2e_replaceStateCount") ?? "0")
  );

  expect(pageErrors).toEqual([]);
  // Nowhere near Safari's 100-calls/10s throttle — a real regression blows
  // past this within the first couple of navigations, not sits near it.
  expect(replaceStateCount).toBeLessThan(20);
});
