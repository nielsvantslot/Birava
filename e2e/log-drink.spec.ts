import path from "path";
import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { LogDrinkPage } from "./pages/LogDrinkPage";
import { TestUserFactory } from "./support/TestUserFactory";

const TEST_PHOTO = path.join(__dirname, "fixtures", "test-photo.jpg");

test.beforeEach(async ({ page, request, baseURL }) => {
  const credentials = await new TestUserFactory(request, baseURL!).ensure();
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(credentials.email, credentials.password);
});

test("logs a drink without a photo", async ({ page }) => {
  const logPage = new LogDrinkPage(page);
  await logPage.goto();

  const drinkName = `E2E No-Photo ${Date.now()}`;
  await logPage.fillDrinkName(drinkName);
  await logPage.submit();

  await expect(logPage.toast()).toHaveText(/Logged/);
});

test("logs a drink with a photo, and it renders once synced", async ({ page }) => {
  const logPage = new LogDrinkPage(page);
  await logPage.goto();

  const drinkName = `E2E With-Photo ${Date.now()}`;
  await logPage.fillDrinkName(drinkName);
  await logPage.attachPhoto(TEST_PHOTO);
  await logPage.submit();
  await expect(logPage.toast()).toHaveText(/Logged/);

  // Submitting queues the check-in and fires the actual save (photo upload
  // + addDrink) in the background (see submitCreate in log-drink-form.tsx)
  // — wait for the pending panel to clear so we know that background save
  // actually landed before checking the dashboard, instead of racing it.
  // Generous timeout: the very first photo upload in a fresh next-dev
  // process pays a one-time cost compiling the photo pipeline and
  // initializing sharp/HEIC's native bindings, on top of the actual resize
  // + WebP re-encode.
  await expect(logPage.pendingPanel()).toBeHidden({ timeout: 60_000 });

  // Also this run's first hit of /dashboard — same cold-compile cost as
  // any other route the first time a fresh next-dev process serves it.
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const card = page.locator(`text=${drinkName}`).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  // session-card.tsx captions the hero photo `${title} photo` — the title
  // for a lone check-in is its drink name.
  await expect(page.locator(`img[alt="${drinkName} photo"]`)).toBeVisible();
});
