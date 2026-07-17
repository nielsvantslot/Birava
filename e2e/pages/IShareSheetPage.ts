import type { Locator } from "@playwright/test";

/** The Strava-style share preview sheet (components/drink/share-sheet.tsx). */
export interface IShareSheetPage {
  root(): Locator;
  shareCta(): Locator;
  currentLabel(): Locator;
  dot(index: number): Locator;
  /** Waits until both image variants have been fetched and the Share button is enabled. */
  waitUntilReady(): Promise<void>;
  goToSlide(index: number): Promise<void>;
}
