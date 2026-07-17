import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { LogDrinkPage } from "./pages/LogDrinkPage";
import { SessionDetailPage } from "./pages/SessionDetailPage";
import { ShareSheetPage } from "./pages/ShareSheetPage";
import { TestUserFactory } from "./support/TestUserFactory";

declare global {
  interface Window {
    __shareCalls?: Array<{ hasFiles: boolean; hasText: boolean; hasTitle: boolean }>;
  }
}

test.beforeEach(async ({ page, request, baseURL }) => {
  // Stub the Web Share API before any navigation — mirrors iOS Safari/Snapchat's
  // share target (supports files) and records exactly what navigator.share()
  // was called with, so the test can assert on it directly.
  await page.addInitScript(() => {
    window.__shareCalls = [];
    navigator.canShare = (data) => !!data?.files?.length;
    navigator.share = async (data) => {
      window.__shareCalls!.push({
        hasFiles: !!data?.files,
        hasText: !!data && "text" in data,
        hasTitle: !!data && "title" in data,
      });
      return undefined;
    };
  });

  const credentials = await new TestUserFactory(request, baseURL!).ensure();
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(credentials.email, credentials.password);
});

test("share sheet: pre-fetches both variants, swipes between them, shares files-only", async ({ page }) => {
  const drinkName = `E2E Share ${Date.now()}`;
  const logPage = new LogDrinkPage(page);
  await logPage.goto();
  await logPage.fillDrinkName(drinkName);
  await logPage.submit();
  await expect(logPage.toast()).toHaveText(/Logged/);

  // The toast is optimistic — the actual save (queue-first logging) lands in
  // the background. Wait for the pending panel to clear before expecting the
  // check-in to actually be on the dashboard (same as log-drink.spec.ts).
  await expect(logPage.pendingPanel()).toBeHidden({ timeout: 60_000 });

  // Registered before navigating to the session page: the recap image is
  // now prefetched the moment that page loads (SocialActs's
  // prefetchShareImage), not on the Share tap — so the request can fire
  // before the share sheet, or even the Share button, exists yet.
  const shareImageRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/share-image")) shareImageRequests.push(req.url());
  });

  const sessionPage = new SessionDetailPage(page);
  // Cold next-dev compile of /dashboard + /sessions/[id] can take a while the
  // first time a fresh process serves them — generous timeout on purpose
  // (same reasoning as log-drink.spec.ts's pendingPanel wait). Opens the
  // topmost (most recent) card rather than matching by title: the e2e suite
  // shares one fixed account across specs, so this check-in can merge into
  // an existing multi-check-in session whose computed title is no longer
  // the drink name just logged.
  await expect(async () => {
    await sessionPage.openMostRecent();
  }).toPass({ timeout: 60_000 });

  await sessionPage.openShareSheet();
  const sheet = new ShareSheetPage(page);
  await expect(sheet.root()).toBeVisible();

  // The Share button starts disabled ("Preparing…") until the prefetch
  // resolves, then becomes usable.
  await sheet.waitUntilReady();
  // Exactly one real request for the whole flow — page load's prefetch,
  // opening the sheet, and (checked below) the eventual Share tap must never
  // add a second one, in dev (React StrictMode) or otherwise.
  expect(shareImageRequests.length).toBe(1);

  await expect(sheet.currentLabel()).toHaveText("Card");
  await sheet.goToSlide(1);
  await expect(sheet.currentLabel()).toHaveText("Sticker");

  const requestsBeforeShareTap = shareImageRequests.length;
  await sheet.shareCta().click();

  // The click must never await a fetch before calling navigator.share() —
  // iOS Safari drops the share sheet's user-activation the instant an await
  // runs first, which silently no-ops the very first tap.
  await expect(async () => {
    expect(shareImageRequests.length).toBe(requestsBeforeShareTap);
  }).toPass({ timeout: 2_000 });

  const calls = await page.evaluate(() => window.__shareCalls);
  expect(calls).toHaveLength(1);
  expect(calls![0]).toMatchObject({ hasFiles: true, hasText: false, hasTitle: false });
});
