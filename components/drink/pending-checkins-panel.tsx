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
