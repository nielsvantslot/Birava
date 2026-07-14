import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { LogDrinkPage } from "./pages/LogDrinkPage";
import { TestUserFactory } from "./support/TestUserFactory";

test.beforeEach(async ({ page, request, baseURL }) => {
  const credentials = await new TestUserFactory(request, baseURL!).ensure();
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(credentials.email, credentials.password);
});

test("a slow request that never finishes before the tab closes still lands the check-in", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const drinkName = `E2E Slow Network ${Date.now()}`;

  const logPage = new LogDrinkPage(page);
  await logPage.goto();

  // Throttle the server action's own POST so it never completes in the
  // window before we close the page — simulates a real slow connection
  // rather than a hard offline cut, which is the scenario that used to lose
  // the entry (see lib/offline/syncPendingCheckins.ts).
  await page.route("**/log", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 15000));
    }
    await route.continue();
  });

  await logPage.fillDrinkName(drinkName);
  await logPage.submit();
  await page.waitForTimeout(400); // long enough to queue, nowhere near the 15s network delay
  await page.close();

  // Reopen on an unthrottled page — PendingCheckinsSync should flush it.
  const freshPage = await context.newPage();
  const freshLogPage = new LogDrinkPage(freshPage);
  await freshLogPage.goto();
  await expect(freshLogPage.pendingPanel()).toBeHidden({ timeout: 30000 });

  const signupCheck = await request.get(`${baseURL}/dashboard`);
  expect(signupCheck.status()).toBeLessThan(500);
});

test("cancelling a queued entry from the pending panel removes it before it syncs", async ({ page, context }) => {
  const drinkName = `E2E Cancel Me ${Date.now()}`;

  const logPage = new LogDrinkPage(page);
  await logPage.goto();
  await context.setOffline(true);

  await logPage.fillDrinkName(drinkName);
  await logPage.submit();
  await expect(logPage.pendingPanel()).toBeVisible();

  await logPage.cancelPending(drinkName);
  await expect(page.locator(`.row:has-text("${drinkName}")`)).not.toBeVisible();

  await context.setOffline(false);
});
