import type { Locator, Page } from "@playwright/test";
import type { IShareSheetPage } from "./IShareSheetPage";

export class ShareSheetPage implements IShareSheetPage {
  constructor(private readonly page: Page) {}

  root(): Locator {
    return this.page.locator(".share-sheet");
  }

  shareCta(): Locator {
    return this.page.locator(".share-cta");
  }

  currentLabel(): Locator {
    return this.page.locator(".share-variant-label");
  }

  dot(index: number): Locator {
    return this.page.locator(".share-dot").nth(index);
  }

  async waitUntilReady(): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const btn = document.querySelector<HTMLButtonElement>(".share-cta");
        return !!btn && !btn.disabled;
      },
      { timeout: 20_000 }
    );
  }

  async goToSlide(index: number): Promise<void> {
    await this.dot(index).click();
  }
}
