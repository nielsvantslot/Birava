"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAllPendingCheckins,
  onPendingCheckinsChanged,
  removePendingCheckin,
  updatePendingCheckin,
  type PendingCheckin,
} from "@/lib/offline/pendingCheckins";
import { flushPendingCheckins } from "@/lib/offline/syncPendingCheckins";

/**
 * Tracks batch progress across a run of sync activity, purely from the
 * reactive `entries` snapshot the panel already gets — no separate event
 * from flushPendingCheckins needed. `batchTotal` resets to null once nothing
 * is active (queued/syncing — "failed" excluded, those are stalled awaiting
 * a manual retry, not part of an in-progress pass) and otherwise only ever
 * grows to cover the largest active count seen since, so a fresh flush
 * captures its starting size and a check-in queued mid-flush extends the
 * total instead of silently under-reporting it.
 *
 * `completedInBatch` is derived from which *ids* have disappeared from
 * `entries` entirely since they were last seen active, not from the gap
 * between `batchTotal` and the current active count — a failed entry stays
 * present in `entries` (status "failed"), so diffing ids correctly never
 * counts a failure as a completion, which a plain count-gap would (an entry
 * failing shrinks the active count exactly the same way one succeeding
 * does).
 */
function useBatchProgress(entries: PendingCheckin[]): { batchTotal: number | null; completedInBatch: number } {
  const activeIds = useMemo(
    () => new Set(entries.filter((e) => e.status !== "failed").map((e) => e.id)),
    [entries]
  );
  const [batchTotal, setBatchTotal] = useState<number | null>(null);
  const [completedInBatch, setCompletedInBatch] = useState(0);
  const trackedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (activeIds.size === 0) {
      setBatchTotal(null);
      setCompletedInBatch(0);
      trackedIdsRef.current = new Set();
      return;
    }

    setBatchTotal((prev) => (prev === null || activeIds.size > prev ? activeIds.size : prev));

    const presentIds = new Set(entries.map((e) => e.id));
    const resolvedSinceLastCheck = [...trackedIdsRef.current].filter((id) => !presentIds.has(id)).length;
    if (resolvedSinceLastCheck > 0) setCompletedInBatch((c) => c + resolvedSinceLastCheck);

    trackedIdsRef.current = new Set([...trackedIdsRef.current, ...activeIds]);
  }, [entries, activeIds]);

  return { batchTotal, completedInBatch };
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
      getAllPendingCheckins(userId).then(setEntries);
    };
    refresh();
    return onPendingCheckinsChanged(refresh);
  }, [userId]);

  const { batchTotal, completedInBatch } = useBatchProgress(entries);
  const isSyncing = entries.some((e) => e.status === "syncing");

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
