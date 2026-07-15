import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { seedBackdatedSessions } from "./support/seedBackdatedSessions";

// Matches drinkController.ts's FEED_SESSION_LIMIT — the dashboard's page size.
const FEED_PAGE_SIZE = 12;

test("scrolling the dashboard feed loads a second page of older sessions", async ({
  page,
  request,
  baseURL,
}) => {
  // A dedicated, never-before-seen user rather than the suite's shared fixed
  // e2e account: getSessionsForUserIds is unstable_cache'd, keyed by tag on
  // the user id(s) queried. Reusing the shared account meant seeded rows
  // could sit behind whatever was already cached for it from an earlier
  // spec/warmup fetch, with no reliable way to force that specific cache
  // entry fresh from outside a real request. A brand-new user has no prior
  // cache entry to collide with, so the first read is guaranteed fresh.
  const email = `e2e-pagination-${Date.now()}@birava.test`;
  const password = "E2eTest123!";
  const signup = await request.post(`${baseURL}/api/signup`, {
    data: { username: `e2e_pagination_${Date.now()}`, email, password },
  });
  if (!signup.ok()) {
    throw new Error(`Failed to create the pagination test user: ${signup.status()} ${await signup.text()}`);
  }

  // One page's worth plus a few more, so some seeded sessions land on page 1
  // and the rest only appear once the feed loads page 2.
  const names = await seedBackdatedSessions(email, FEED_PAGE_SIZE + 3, `E2E Scroll ${Date.now()}`);
  const newestName = names[names.length - 1]!;
  const secondPageName = names[0]!; // oldest of the batch — pushed onto page 2

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(email, password);

  await page.goto("/dashboard?tab=you", { waitUntil: "networkidle" });

  await expect(page.locator(`text=${newestName}`)).toBeVisible();
  await expect(page.locator(`text=${secondPageName}`)).not.toBeVisible();

  // The sentinel's rootMargin (800px) means scrolling to the bottom is
  // enough to trigger the IntersectionObserver fetch well before it's
  // actually on-screen.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator(`text=${secondPageName}`)).toBeVisible({ timeout: 15000 });
});
