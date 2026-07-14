import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { TestUserFactory } from "./support/TestUserFactory";

test("logs in with valid credentials and reaches the dashboard", async ({ page, request, baseURL }) => {
  const credentials = await new TestUserFactory(request, baseURL!).ensure();

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(credentials.email, credentials.password);

  await expect(page).toHaveURL(/\/dashboard/);
});

test("shows an error for the wrong password instead of logging in", async ({ page, request, baseURL }) => {
  const credentials = await new TestUserFactory(request, baseURL!).ensure();

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await page.fill("#email", credentials.email);
  await page.fill("#password", "definitely-the-wrong-password");
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator("text=/incorrect|invalid/i")).toBeVisible();
});
