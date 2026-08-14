"use client";

import { useEffect, useState } from "react";
import {
  getAllPendingCheckins,
  onPendingCheckinsChanged,
  removePendingCheckin,
  updatePendingCheckin,
  type PendingCheckin,
} from "@/lib/offline/pendingCheckins";
import { flushPendingCheckins } from "@/lib/offline/syncPendingCheckins";

/**
 * Tracks a "batch total" across a run of sync activity, purely from the
 * reactive `entries` snapshot the panel already gets — no separate event
 * from flushPendingCheckins needed. `active` (queued + syncing, i.e.
 * "failed" excluded — those are stalled awaiting a manual retry, not part
 * of an in-progress pass) resets the batch to null once it hits 0, and
 * otherwise only ever grows to cover the largest active count seen since —
 * so a fresh flush captures its starting size, and a check-in queued mid-
 * flush extends the total instead of silently under-reporting it.
 */
function useBatchTotal(active: number): number | null {
  const [batchTotal, setBatchTotal] = useState<number | null>(null);
  useEffect(() => {
    setBatchTotal((prev) => {
      if (active === 0) return null;
      if (prev === null || active > prev) return active;
      return prev;
    });
  }, [active]);
  return batchTotal;
}

function statusLabel(entry: PendingCheckin): string {
  switch (entry.status) {
    case "syncing":
      return "Syncing…";
    case "failed":
      return `Couldn't sync — ${entry.lastError ?? "unknown error"}`;
    default:
      return "Queued — waiting for connection";
  }
}

/**
 * Visibility + cancellation for the offline check-in queue
 * (lib/offline/pendingCheckins.ts) — a durable but otherwise invisible/silent
 * queue is worse than the previous behavior in some ways, so this gives the
 * user a way to see and back out of what's about to sync.
 */
export function PendingCheckinsPanel({
  userId,
  supportsDirectUpload,
}: {
  userId: string;
  supportsDirectUpload: boolean;
}) {
  const [entries, setEntries] = useState<PendingCheckin[]>([]);

  useEffect(() => {
    const refresh = () => {
      getAllPendingCheckins().then(setEntries);
    };
    refresh();
    return onPendingCheckinsChanged(refresh);
  }, []);

  const activeCount = entries.filter((e) => e.status !== "failed").length;
  const batchTotal = useBatchTotal(activeCount);
  const isSyncing = entries.some((e) => e.status === "syncing");
  // "completed so far" is just the gap between the batch's starting size and
  // what's still active — items only leave `entries` by succeeding (a failed
  // entry stays, excluded from `active` above but still present), so this
  // can't be thrown off by failures.
  const completedInBatch = batchTotal !== null ? Math.max(0, batchTotal - activeCount) : 0;

  if (entries.length === 0) return null;

  const cancel = async (entry: PendingCheckin) => {
    if (entry.photo.kind === "uploaded") {
      fetch("/api/uploads/drink-photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: entry.photo.url }),
      }).catch(() => {});
    }
    await removePendingCheckin(entry.id);
  };

  const retry = async (entry: PendingCheckin) => {
    await updatePendingCheckin(entry.id, { status: "queued", lastError: undefined });
    flushPendingCheckins(userId, supportsDirectUpload);
  };

  return (
    <div className="section">
      <div className="h-row">
        <h3>Pending sync ({entries.length})</h3>
      </div>
      {/* Only worth a line of its own once there's more than one item to
          report progress across — a lone item already says "Syncing…"
          inline below, and batchTotal <= 1 would just repeat that. */}
      {isSyncing && batchTotal !== null && batchTotal > 1 && (
        <p style={{ fontSize: 13, color: "var(--ink-dim)", margin: "-4px 0 8px" }}>
          Syncing {completedInBatch + 1} of {batchTotal}…
        </p>
      )}
      {entries.map((entry) => (
        <div key={entry.id} className="row">
          <div className="rowmark">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9.5"></circle>
              <path d="M12 7v5l3 2"></path>
            </svg>
          </div>
          <div className="grow">
            <b>{entry.payload.drinkName?.trim() || entry.payload.drinkType}</b>
            <span
              style={entry.status === "failed" ? { color: "var(--destructive)" } : undefined}
            >
              {statusLabel(entry)}
            </span>
          </div>
          {entry.status === "failed" && (
            <button type="button" className="chip" onClick={() => retry(entry)}>
              Retry now
            </button>
          )}
          {/* Hidden once syncing — flushPendingCheckins flips status to
              "syncing" (and this panel re-renders reactively) before it
              starts the actual network calls, so this closes the window
              where a click could remove the local record while the request
              is already in flight and about to land anyway. */}
          {entry.status !== "syncing" && (
            <button type="button" className="chip" onClick={() => cancel(entry)}>
              Cancel
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
