import path from "path";
import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { LogDrinkPage } from "./pages/LogDrinkPage";
import { SessionDetailPage } from "./pages/SessionDetailPage";
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

  // Not matched by drink name on the dashboard feed card, and opened via
  // openMostRecent() rather than a title match — the e2e suite shares one
  // fixed account across specs (other specs log their own drinks too), so
  // this check-in can merge into an existing multi-check-in session whose
  // card/title no longer headlines this exact drink name (same reasoning
  // as SessionDetailPage.openMostRecent()'s own doc comment). The photo
  // tile's alt (checkin-grid.tsx's `item.caption`) always includes the
  // drink name regardless of merge state, so it's what's asserted on
  // instead of the session-level title/hero photo.
  const sessionPage = new SessionDetailPage(page);
  await expect(async () => {
    await sessionPage.openMostRecent();
  }).toPass({ timeout: 60_000 });
  await expect(page.locator(`img[alt*="${drinkName}"]`)).toBeVisible({ timeout: 30_000 });
});
