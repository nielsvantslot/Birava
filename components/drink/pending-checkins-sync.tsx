"use client";

import { useEffect } from "react";
import { flushPendingCheckins } from "@/lib/offline/syncPendingCheckins";

// Covers a tab that never fires `online`/`visibilitychange` at all — e.g. a
// captive portal, a degraded/flaky connection where the browser never
// actually thinks it went offline, or a transient server error — while
// staying open and foregrounded on /log the whole time. Without this, a
// "queued" entry from one of those failures would just sit there until the
// user happens to switch tabs or navigate. 45s matches
// syncPendingCheckins.ts's own SYNC_STEP_TIMEOUT_MS scale; flushPendingCheckins
// is already a cheap no-op when the queue is empty (an early return before
// any network call) and self-deduplicates against an overlapping trigger (the
// module-level `flushing` guard), so polling unconditionally costs nothing
// on the common case of nothing queued.
const RETRY_POLL_MS = 45_000;

/**
 * Flushes the offline check-in queue (lib/offline/pendingCheckins.ts)
 * whenever there's a reasonable chance connectivity just came back: on
 * mount, when the browser fires `online`, when the tab regains visibility,
 * and on a bounded interval as a backstop for the cases above where none of
 * those ever fires. Deliberately doesn't use the Service Worker / Background
 * Sync API — WebKit doesn't implement Background Sync at all, so relying on
 * it would mean the queue never flushes on iOS Safari without this same
 * foreground fallback anyway.
 */
export function PendingCheckinsSync({
  userId,
  supportsDirectUpload,
}: {
  userId: string;
  supportsDirectUpload: boolean;
}) {
  useEffect(() => {
    const flush = () => {
      flushPendingCheckins(userId, supportsDirectUpload);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") flush();
    };

    flush();
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const pollId = window.setInterval(flush, RETRY_POLL_MS);

    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(pollId);
    };
  }, [userId, supportsDirectUpload]);

  return null;
}
