"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getAllPendingCheckins,
  onPendingCheckinsChanged,
  updatePendingCheckin,
  type PendingCheckin,
} from "@/lib/offline/pendingCheckins";
import { flushPendingCheckins } from "@/lib/offline/syncPendingCheckins";

/**
 * An app-wide status bar for the offline check-in queue
 * (lib/offline/pendingCheckins.ts). PendingCheckinsPanel only renders on
 * /log, so anywhere else a stuck or permanently-failed check-in was
 * invisible: log-drink-form.tsx shows its "Logged" toast the instant an
 * entry is queued and deliberately lets the user navigate away right away,
 * so a later failure (bad photo format, a sync timeout) had no surface at
 * all outside the one page they'd usually already left. Deliberately not
 * the panel's full per-entry list — just enough that a failure is never
 * silent, with a one-tap fix that doesn't require navigating to /log first.
 */
export function PendingCheckinsIndicator({
  userId,
  supportsDirectUpload,
}: {
  userId: string;
  supportsDirectUpload: boolean;
}) {
  const [entries, setEntries] = useState<PendingCheckin[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    const refresh = () => {
      getAllPendingCheckins(userId).then(setEntries);
    };
    refresh();
    return onPendingCheckinsChanged(refresh);
  }, [userId]);

  const failed = entries.filter((e) => e.status === "failed");
  const active = entries.filter((e) => e.status !== "failed");

  // PendingCheckinsPanel already renders the same information, per-entry,
  // right there on the page — a second summary bar stacked on top of it
  // would just be noise, not an aid to visibility.
  if (pathname === "/log") return null;
  if (failed.length === 0 && active.length === 0) return null;

  const retryAll = () => {
    Promise.all(
      failed.map((e) => updatePendingCheckin(e.id, { status: "queued", lastError: undefined }))
    ).then(() => flushPendingCheckins(userId, supportsDirectUpload));
  };

  return (
    <div
      role="status"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 48,
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--line)",
        color: failed.length > 0 ? "var(--destructive)" : "var(--ink-dim)",
        fontSize: 12.5,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "6px 12px",
      }}
    >
      {failed.length > 0 ? (
        <>
          <span>
            Couldn&apos;t sync {failed.length} check-in{failed.length > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={retryAll}
            style={{
              fontWeight: 700,
              textDecoration: "underline",
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Retry
          </button>
          <Link href="/log" style={{ textDecoration: "underline", color: "inherit" }}>
            View
          </Link>
        </>
      ) : (
        <span>
          Syncing {active.length} check-in{active.length > 1 ? "s" : ""}…
        </span>
      )}
    </div>
  );
}
