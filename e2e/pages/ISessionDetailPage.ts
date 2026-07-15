import type { Locator } from "@playwright/test";

/** The /sessions/[id] screen, reached from a dashboard feed card. */
export interface ISessionDetailPage {
  /** Finds the feed card whose title matches `titleText` and opens it. */
  openFromDashboard(titleText: string): Promise<void>;
  shareButton(): Locator;
  openShareSheet(): Promise<void>;
}
