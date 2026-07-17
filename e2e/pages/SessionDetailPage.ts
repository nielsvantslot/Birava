import type { Locator, Page } from "@playwright/test";
import type { ISessionDetailPage } from "./ISessionDetailPage";

export class SessionDetailPage implements ISessionDetailPage {
  constructor(private readonly page: Page) {}

  async openMostRecent(): Promise<void> {
    await this.page.goto("/dashboard", { waitUntil: "networkidle" });
    await this.page.locator(".act-title-link").first().click();
    await this.page.waitForURL(/\/sessions\//, { timeout: 30_000 });
  }

  shareButton(): Locator {
    return this.page.locator('button[aria-label="Share session"]');
  }

  async openShareSheet(): Promise<void> {
    await this.shareButton().click();
  }

  commentCountPill(): Locator {
    return this.page.locator('[aria-label="Comments"]');
  }

  commentsHeaderCount(): Locator {
    return this.page.locator("#comments .h-row span");
  }

  async postComment(body: string): Promise<void> {
    await this.page.locator(".comment-form input[type='text']").fill(body);
    await this.page.locator(".comment-form button[type='submit']").click();
  }
}
