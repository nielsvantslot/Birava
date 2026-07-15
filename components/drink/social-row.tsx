"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleCheer } from "@/lib/controllers/socialController";
import { showToast } from "@/components/ui/toast-pill";
import { cn } from "@/lib/utils";
import { ShareSheet } from "@/components/drink/share-sheet";

/**
 * The session card's social affordances: cheers with a live count,
 * comment, share. Icon buttons, no emoji.
 */
export function SocialActs({
  entryId,
  count,
  on,
  commentCount,
  shareText,
  isOwner,
}: {
  /** Session anchor check-in id the cheers/comments are keyed by. */
  entryId: string;
  count: number;
  on: boolean;
  commentCount: number;
  shareText: string;
  /** Only the owner's own session gets the recap-image share; others get a link. */
  isOwner: boolean;
}) {
  const [state, setState] = useState({ count, on });
  const [, startTransition] = useTransition();
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  const handleCheer = () => {
    // Optimistic — settle with the server's answer
    setState((s) => ({ on: !s.on, count: s.count + (s.on ? -1 : 1) }));
    startTransition(async () => {
      const result = await toggleCheer({ entryId });
      if (result.error) {
        setState({ count, on });
        showToast(result.error);
        return;
      }
      setState({ count: result.count!, on: result.on! });
    });
  };

  const shareTextOnly = async (url?: string) => {
    if (navigator.share) {
      try {
        await navigator.share(url ? { text: shareText, url } : { text: shareText });
      } catch {
        /* user cancelled */
      }
      return;
    }
    await navigator.clipboard.writeText(url ? `${shareText} ${url}` : shareText);
    showToast("Copied to clipboard");
  };

  // Someone else's session: never generate their recap image (that reads as
  // claiming their session) — just share/copy a link to it.
  const handleShareLink = async () => {
    const url = `${window.location.origin}/sessions/${entryId}`;
    await shareTextOnly(url);
  };

  // Own session: open the share preview (Strava-style — swipe between the
  // card and sticker versions, then hand the picked one to the OS share
  // sheet). Someone else's session skips straight to the link share.
  const handleShare = () => {
    if (isOwner) setShareSheetOpen(true);
    else handleShareLink();
  };

  return (
    <div className="social acts">
      <button
        className={cn("act cheer", state.on && "on")}
        onClick={handleCheer}
        aria-pressed={state.on}
        aria-label="Cheers"
      >
        <svg viewBox="0 0 24 24">
          <path d="M9 3h6M12 3v4"></path>
          <path d="M7 21c-2 0-3-1.6-3-3.5C4 13 7 11 12 11s8 2 8 6.5c0 1.9-1 3.5-3 3.5z"></path>
        </svg>
        <span>{state.count}</span> cheers
      </button>
      <Link
        className="act"
        href={`/sessions/${entryId}#comments`}
        aria-label="Comments"
        scroll={false}
      >
        <svg viewBox="0 0 24 24">
          <path d="M4 5h16v11H9l-5 4z"></path>
        </svg>
        <span>{commentCount}</span> comment{commentCount === 1 ? "" : "s"}
      </Link>
      <button className="act share" onClick={handleShare} aria-label="Share session">
        <svg viewBox="0 0 24 24">
          <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7"></path>
          <path d="M12 3v13M8 7l4-4 4 4"></path>
        </svg>
        Share
      </button>
      {shareSheetOpen && (
        <ShareSheet entryId={entryId} onClose={() => setShareSheetOpen(false)} />
      )}
    </div>
  );
}
