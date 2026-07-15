import type { Locator, Page } from "@playwright/test";
import type { ISessionDetailPage } from "./ISessionDetailPage";

export class SessionDetailPage implements ISessionDetailPage {
  constructor(private readonly page: Page) {}

  async openFromDashboard(titleText: string): Promise<void> {
    await this.page.goto("/dashboard", { waitUntil: "networkidle" });
    await this.page.locator(".act-title-link", { hasText: titleText }).first().click();
    await this.page.waitForURL(/\/sessions\//, { timeout: 30_000 });
  }

  shareButton(): Locator {
    return this.page.locator('button[aria-label="Share session"]');
  }

  async openShareSheet(): Promise<void> {
    await this.shareButton().click();
  }
}
