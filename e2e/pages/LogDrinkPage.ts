import type { Locator, Page } from "@playwright/test";
import type { ILogDrinkPage } from "./ILogDrinkPage";

export class LogDrinkPage implements ILogDrinkPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/log", { waitUntil: "networkidle" });
  }

  async fillDrinkName(name: string): Promise<void> {
    await this.page.fill("#drink-name", name);
  }

  async attachPhoto(filePath: string): Promise<void> {
    await this.page.locator('input[type="file"]').first().setInputFiles(filePath);
  }

  async removePhoto(): Promise<void> {
    await this.page.click('button:has-text("Remove")');
  }

  async submit(): Promise<void> {
    await this.page.click('button[type="submit"]');
  }

  toast(): Locator {
    return this.page.locator(".toast.show");
  }

  pendingPanel(): Locator {
    return this.page.locator("text=Pending sync");
  }

  async cancelPending(drinkName: string): Promise<void> {
    await this.page
      .locator(`.row:has-text("${drinkName}")`)
      .locator('button:has-text("Cancel")')
      .click();
  }
}
