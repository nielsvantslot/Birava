import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { LogDrinkPage } from "./pages/LogDrinkPage";
import { SessionDetailPage } from "./pages/SessionDetailPage";
import { TestUserFactory } from "./support/TestUserFactory";

test.beforeEach(async ({ page, request, baseURL }) => {
  const credentials = await new TestUserFactory(request, baseURL!).ensure();
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(credentials.email, credentials.password);
});

test("posting a comment keeps the session's comment-count pill in sync with the thread", async ({ page }) => {
  const drinkName = `E2E Comment ${Date.now()}`;
  const logPage = new LogDrinkPage(page);
  await logPage.goto();
  await logPage.fillDrinkName(drinkName);
  await logPage.submit();
  await expect(logPage.toast()).toHaveText(/Logged/);
  await expect(logPage.pendingPanel()).toBeHidden({ timeout: 60_000 });

  const sessionPage = new SessionDetailPage(page);
  await expect(async () => {
    await sessionPage.openMostRecent();
  }).toPass({ timeout: 60_000 });

  // Read whatever the counts start at (the e2e suite shares one account
  // across specs, so this session may already have earlier comments on it)
  // rather than assuming a fresh 0 — the invariant under test is that the
  // two counters agree, not their absolute starting value.
  const pillCountBefore = await sessionPage.commentCountPill().innerText();
  const headerCountBefore = await sessionPage.commentsHeaderCount().innerText();
  const before = parseInt(headerCountBefore, 10);
  expect(pillCountBefore).toContain(String(before));

  await sessionPage.postComment(`e2e comment ${Date.now()}`);

  // The pill is fed by a separate Suspense boundary (SocialLoader) from the
  // comment thread (CommentsLoader) — it only picks up the new count via
  // the router.refresh() the post triggers, which is itself async.
  await expect(sessionPage.commentsHeaderCount()).toHaveText(String(before + 1));
  await expect(sessionPage.commentCountPill()).toContainText(String(before + 1), { timeout: 5_000 });
});
