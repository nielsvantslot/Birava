import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
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
  // and the rest only appear once the feed loads page 2.
  const names = await seedBackdatedSessions(
    credentials.email,
    FEED_PAGE_SIZE + 3,
    `E2E Scroll ${Date.now()}`
  );
  const newestName = names[names.length - 1]!;
  const secondPageName = names[0]!; // oldest of the batch — pushed onto page 2

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(credentials.email, credentials.password);

  await page.goto("/dashboard?tab=you", { waitUntil: "networkidle" });

  await expect(page.locator(`text=${newestName}`)).toBeVisible();
  await expect(page.locator(`text=${secondPageName}`)).not.toBeVisible();

  // The sentinel's rootMargin (800px) means scrolling to the bottom is
  // enough to trigger the IntersectionObserver fetch well before it's
  // actually on-screen.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator(`text=${secondPageName}`)).toBeVisible({ timeout: 15000 });
});
