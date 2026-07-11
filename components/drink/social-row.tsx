"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleProost } from "@/lib/controllers/socialController";
import { showToast } from "@/components/ui/toast-pill";
import { cn } from "@/lib/utils";

/**
 * The session card's social affordances: proost with a live count,
 * comment, share. Icon buttons, no emoji.
 */
export function SocialActs({
  entryId,
  count,
  on,
  commentCount,
  shareText,
}: {
  /** Session anchor check-in id the proost/comments are keyed by. */
  entryId: string;
  count: number;
  on: boolean;
  commentCount: number;
  shareText: string;
}) {
  const [state, setState] = useState({ count, on });
  const [, startTransition] = useTransition();

  const handleProost = () => {
    // Optimistic — settle with the server's answer
    setState((s) => ({ on: !s.on, count: s.count + (s.on ? -1 : 1) }));
    startTransition(async () => {
      const result = await toggleProost({ entryId });
      if (result.error) {
        setState({ count, on });
        showToast(result.error);
        return;
      }
      setState({ count: result.count!, on: result.on! });
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch {
        /* user cancelled */
      }
      return;
    }
    await navigator.clipboard.writeText(shareText);
    showToast("Copied to clipboard");
  };

  return (
    <div className="social acts">
      <button
        className={cn("act proost", state.on && "on")}
        onClick={handleProost}
        aria-pressed={state.on}
        aria-label="Proost"
      >
        <svg viewBox="0 0 24 24">
          <path d="M9 3h6M12 3v4"></path>
          <path d="M7 21c-2 0-3-1.6-3-3.5C4 13 7 11 12 11s8 2 8 6.5c0 1.9-1 3.5-3 3.5z"></path>
        </svg>
        <span>{state.count}</span> proost
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
    </div>
  );
}
