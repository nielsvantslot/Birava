"use client";

import { useTransition } from "react";
import Link from "next/link";
import { addPendingCheckin } from "@/lib/offline/pendingCheckins";
import { flushPendingCheckins } from "@/lib/offline/syncPendingCheckins";
import { showToast } from "@/components/ui/toast-pill";
import { BeerGlassIcon } from "@/components/drink/beer-glass-icon";
import type { DrinkEntry } from "@/lib/types";

/**
 * A row in /log's "Recent" list. Its primary action is now "log again" —
 * queue a fresh check-in with this entry's type/name/venue, no retyping —
 * rather than the row itself linking into edit mode. Editing is still
 * available, just as its own explicit, smaller affordance, so the two
 * intents (repeat vs. correct a past entry) aren't collapsed into one
 * ambiguous tap target.
 */
export function RecentDrinkRow({
  entry,
  meta,
  userId,
  supportsDirectUpload,
}: {
  entry: Pick<DrinkEntry, "id" | "drink_name" | "drink_type" | "venue">;
  meta: string;
  userId: string;
  supportsDirectUpload: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const logAgain = () => {
    startTransition(async () => {
      await addPendingCheckin({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        payload: {
          drinkName: entry.drink_name,
          drinkType: entry.drink_type,
          venue: entry.venue,
          lat: null,
          lng: null,
        },
        photo: { kind: "none" },
      });
      showToast("Logged again — added to tonight's session");
      flushPendingCheckins(userId, supportsDirectUpload, { silent: true }).catch(() => {});
    });
  };

  return (
    <div className="row">
      <div className="rowmark">
        <BeerGlassIcon />
      </div>
      <div className="grow">
        <b>{entry.drink_name?.trim() || entry.drink_type}</b>
        <span>{meta}</span>
      </div>
      <button type="button" className="chip" disabled={isPending} onClick={logAgain}>
        {isPending ? "Logging…" : "Log again"}
      </button>
      <Link
        href={`/log?edit=${entry.id}`}
        aria-label="Edit check-in"
        prefetch={false}
        style={{ display: "grid", placeItems: "center", padding: 4, color: "var(--ink-dim)" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"></path>
        </svg>
      </Link>
    </div>
  );
}
