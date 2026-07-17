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
  /** The "N comments" pill above the check-ins grid (components/drink/social-row.tsx) — fed by a separate Suspense boundary from the comment thread below, so it only stays in sync if posting/deleting calls router.refresh(). */
  commentCountPill(): Locator;
  /** The comment thread's own "Comments N" header count (components/drink/comments-section.tsx) — driven by local state, always up to date the instant a comment posts. */
  commentsHeaderCount(): Locator;
  postComment(body: string): Promise<void>;
}
