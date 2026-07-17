import type { Page } from "@playwright/test";
import type { ILoginPage } from "./ILoginPage";

export class LoginPage implements ILoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/login", { waitUntil: "networkidle" });
  }

  async login(email: string, password: string): Promise<void> {
    await this.page.fill("#email", email);
    await this.page.fill("#password", password);
    await this.page.click('button[type="submit"]');
    // Cold next-dev compile of /dashboard alone can take ~15s — generous on purpose.
    await this.page.waitForURL(/\/dashboard/, { timeout: 30000 });
  }
}
