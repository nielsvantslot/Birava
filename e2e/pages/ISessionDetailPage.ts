import type { Locator } from "@playwright/test";

/** The /sessions/[id] screen, reached from a dashboard feed card. */
export interface ISessionDetailPage {
  /**
   * Opens the most recent session on the dashboard feed (the topmost card).
   * Not matched by title text — the e2e suite shares one fixed test account
   * across specs, so a just-logged check-in can merge into an existing
   * multi-check-in session whose computed title ("Evening session", etc.)
   * no longer matches the drink name that was just logged.
   */
  openMostRecent(): Promise<void>;
  shareButton(): Locator;
  openShareSheet(): Promise<void>;
}
