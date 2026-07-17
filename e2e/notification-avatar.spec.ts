import { expect, test } from "@playwright/test";
import path from "path";
import { LoginPage } from "./pages/LoginPage";
import { TestUserFactory, SECONDARY_CREDENTIALS } from "./support/TestUserFactory";

/**
 * Regression test for a real bug: Notification.actorAvatarUrl is a
 * denormalized snapshot of the actor's avatar URL, taken at
 * notification-creation time. Once avatars became private-blob-only
 * (served through /api/avatars/[userId], never a raw stored URL), that
 * snapshot stopped being fetchable directly — every notification's actor
 * avatar silently broke. The fix renders avatarSrc(actorId) instead
 * (app/(app)/notifications/page.tsx) — this test drives two real accounts
 * through the actual follow flow and asserts the avatar genuinely loads,
 * not just that an <img> tag with *some* src exists.
 */
test("a notification's actor avatar renders through the private-blob proxy and actually loads", async ({
  page,
  request,
  baseURL,
  browser,
}) => {
  const recipient = await new TestUserFactory(request, baseURL!).ensure();
  const actor = await new TestUserFactory(request, baseURL!, SECONDARY_CREDENTIALS).ensure();

  // The actor: log in, give them an avatar (so there's something to break).
  const actorLogin = new LoginPage(page);
  await actorLogin.goto();
  await actorLogin.login(actor.email, actor.password);

  await page.goto("/profile", { waitUntil: "networkidle" });
  await page
    .locator('input[type="file"][accept="image/*"]')
    .setInputFiles(path.join(__dirname, "..", "prisma", "seed-assets", "party-cup.jpg"));
  // Not just ".avatar img" — that also matches the sidebar rail's own avatar
  // link, which shows the same picture and would make this locator resolve
  // to two elements (strict-mode violation).
  await expect(page.locator('[aria-label="Change profile picture"] img')).toBeVisible({ timeout: 15_000 });

  // Follow the recipient — queueNotifications (lib/notify.ts) writes the
  // FOLLOW notification via Next's after(), deferred past the response, so
  // the recipient's notification may not exist the instant this click
  // resolves.
  await page.goto("/people", { waitUntil: "networkidle" });
  await page.fill("#people-search", recipient.username);
  await page.locator(`.row:has-text("${recipient.username}")`).waitFor();
  await page.locator(`.row:has-text("${recipient.username}") button`).click();

  // The recipient: separate browser context — two real users need to be
  // logged in simultaneously.
  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();
  const recipientLogin = new LoginPage(recipientPage);
  await recipientLogin.goto();
  await recipientLogin.login(recipient.email, recipient.password);

  await expect(async () => {
    await recipientPage.goto("/notifications", { waitUntil: "networkidle" });
    await expect(recipientPage.locator(".rowmark img").first()).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 20_000 });

  const avatarImg = recipientPage.locator(".rowmark img").first();
  const src = await avatarImg.getAttribute("src");
  // Not a raw stored blob URL — the proxy path, keyed by the actor's id.
  expect(src).toMatch(/^\/api\/avatars\/[0-9a-f-]+$/);

  // The actual regression: a broken image (private blob URL, 401/404) still
  // renders an <img> tag with *a* src — only naturalWidth reveals whether
  // the browser could actually decode real bytes from it.
  const naturalWidth = await avatarImg.evaluate((img) => (img as HTMLImageElement).naturalWidth);
  expect(naturalWidth).toBeGreaterThan(0);

  await recipientContext.close();
});
