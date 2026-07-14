"use client";

import { useEffect } from "react";
import { flushPendingCheckins } from "@/lib/offline/syncPendingCheckins";

/**
 * Flushes the offline check-in queue (lib/offline/pendingCheckins.ts)
 * whenever there's a reasonable chance connectivity just came back: on
 * mount, when the browser fires `online`, and when the tab regains
 * visibility. Deliberately doesn't use the Service Worker / Background Sync
 * API — WebKit doesn't implement Background Sync at all, so relying on it
 * would mean the queue never flushes on iOS Safari without this same
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

    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [userId, supportsDirectUpload]);

  return null;
}
