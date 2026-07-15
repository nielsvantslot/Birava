import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { LogDrinkPage } from "./pages/LogDrinkPage";
import { TestUserFactory } from "./support/TestUserFactory";
import { seedBackdatedSessions } from "./support/seedBackdatedSessions";

// Matches drinkController.ts's FEED_SESSION_LIMIT — the dashboard's page size.
const FEED_PAGE_SIZE = 12;

test("scrolling the dashboard feed loads a second page of older sessions", async ({
  page,
  request,
  baseURL,
}) => {
  const credentials = await new TestUserFactory(request, baseURL!).ensure();

  // One page's worth plus a few more, so some seeded sessions land on page 1
  // and the rest only appear once the feed loads page 2. All backdated well
  // into the past — the real check-in logged below is the newest.
  const names = await seedBackdatedSessions(
    credentials.email,
    FEED_PAGE_SIZE + 3,
    `E2E Scroll ${Date.now()}`
  );
  const secondPageName = names[0]!; // oldest of the batch — pushed onto page 2

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(credentials.email, credentials.password);

  // getSessionsForUserIds is unstable_cache'd, keyed by tag on this user —
  // busted only when a real addDrink/editDrink/deleteDrink revalidates it.
  // seedBackdatedSessions writes rows directly (no such revalidation), so
  // without this they'd sit behind whatever was already cached for this
  // shared e2e account (e.g. from global-setup's own login-time fetch).
  // Logging one real drink here both revalidates that cache and gives a
  // reliably "newest" marker to assert against.
  const newestName = `E2E Scroll Newest ${Date.now()}`;
  const logPage = new LogDrinkPage(page);
  await logPage.goto();
  await logPage.fillDrinkName(newestName);
  await logPage.submit();
  await expect(logPage.toast()).toHaveText(/Logged/);

  // Logging is queue-first (lib/offline/syncPendingCheckins.ts): the toast
  // above fires the instant the check-in is queued, not once addDrink (and
  // its revalidateTag) has actually run. Wait for the pending panel to
  // clear so the real server round-trip — the one that busts the cache —
  // has genuinely finished before checking the dashboard.
  await expect(logPage.pendingPanel()).toBeHidden({ timeout: 30000 });

  await page.goto("/dashboard?tab=you", { waitUntil: "networkidle" });

  await expect(page.locator(`text=${newestName}`)).toBeVisible();
  await expect(page.locator(`text=${secondPageName}`)).not.toBeVisible();

  // The sentinel's rootMargin (800px) means scrolling to the bottom is
  // enough to trigger the IntersectionObserver fetch well before it's
  // actually on-screen.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator(`text=${secondPageName}`)).toBeVisible({ timeout: 15000 });
});
