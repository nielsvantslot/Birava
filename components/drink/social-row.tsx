"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toggleCheer } from "@/lib/controllers/socialController";
import { showToast } from "@/components/ui/toast-pill";
import { cn } from "@/lib/utils";
import type { ShareImageDTO } from "@/lib/dtos";
import type { ShareVariant } from "@/components/drink/share-sheet";

// SocialActs renders on every session card — dashboard feed, profile,
// session lists — but the sheet itself only matters to the small fraction
// of views where someone actually taps Share. Loading its module on demand
// keeps that cost off every card's initial bundle.
const ShareSheet = dynamic(() => import("@/components/drink/share-sheet").then((m) => m.ShareSheet));

const VARIANT_LABELS: Record<ShareVariant["key"], string> = { opaque: "Card", transparent: "Sticker" };

async function dataUriToFile(dataUri: string, filename: string): Promise<File> {
  const res = await fetch(dataUri);
  const blob = await res.blob();
  // blob.type comes from the data URI's own declared MIME — the opaque card
  // is JPEG (see the route), the transparent sticker is PNG; don't hardcode.
  return new File([blob], filename, { type: blob.type || "image/png" });
}

async function fetchShareVariants(sessionId: string): Promise<ShareVariant[] | null> {
  const res = await fetch(`/api/sessions/${sessionId}/share-image`);
  if (!res.ok) return null;
  const data = (await res.json()) as ShareImageDTO;
  const [opaqueFile, transparentFile] = await Promise.all([
    dataUriToFile(data.opaque, "birava-session-card.jpg"),
    dataUriToFile(data.transparent, "birava-session-sticker.png"),
  ]);
  return [
    { key: "opaque", label: VARIANT_LABELS.opaque, dataUri: data.opaque, file: opaqueFile },
    { key: "transparent", label: VARIANT_LABELS.transparent, dataUri: data.transparent, file: transparentFile },
  ];
}

/**
 * The session card's social affordances: cheers with a live count,
 * comment, share. Icon buttons, no emoji.
 */
export function SocialActs({
  sessionId,
  count,
  on,
  commentCount,
  shareText,
  isOwner,
  prefetchShareImage = false,
}: {
  /** Session anchor check-in id the cheers/comments are keyed by. */
  sessionId: string;
  count: number;
  on: boolean;
  commentCount: number;
  shareText: string;
  /** Only the owner's own session gets the recap-image share; others get a link. */
  isOwner: boolean;
  /**
   * Warm the recap image the moment this card mounts, instead of waiting for
   * the Share tap — so by the time it's actually pressed, the request almost
   * always hits an already-generated image rather than a fresh render (tile
   * fetch + Satori + re-encode). Only ever pass `true` from a session's own
   * detail page (exactly one session on screen); a feed/list of many session
   * cards must never set this, or every visible card would generate its
   * recap image whether or not anyone shares it.
   */
  prefetchShareImage?: boolean;
}) {
  const [state, setState] = useState({ count, on });
  const [, startTransition] = useTransition();
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareVariants, setShareVariants] = useState<ShareVariant[] | null>(null);
  const [shareReady, setShareReady] = useState(false);
  // Guards the fetch to exactly one real network request no matter which of
  // the two triggers below gets there first, and survives React StrictMode's
  // dev-only double-invoke of the mount effect (a second invocation sees
  // this already set and skips straight past it — no AbortController/cancel
  // dance needed since there's only ever one fetch to begin with).
  const shareFetchStarted = useRef(false);

  const ensureShareFetch = useCallback(() => {
    if (shareFetchStarted.current) return;
    shareFetchStarted.current = true;
    fetchShareVariants(sessionId)
      .then(setShareVariants)
      .catch(() => setShareVariants(null))
      .finally(() => setShareReady(true));
  }, [sessionId]);

  // Deliberately not aborted on unmount (e.g. navigating away before this
  // resolves) — the point of prefetching is to warm the server's cache
  // (lib/shareImageCache.ts) regardless of whether this exact component
  // instance is still around to see the result.
  useEffect(() => {
    if (isOwner && prefetchShareImage) ensureShareFetch();
  }, [isOwner, prefetchShareImage, ensureShareFetch]);

  const handleCheer = () => {
    // Optimistic — settle with the server's answer
    setState((s) => ({ on: !s.on, count: s.count + (s.on ? -1 : 1) }));
    startTransition(async () => {
      const result = await toggleCheer({ sessionId });
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
    const url = `${window.location.origin}/sessions/${sessionId}`;
    await shareTextOnly(url);
  };

  // Own session: open the share preview (Strava-style — swipe between the
  // card and sticker versions, then hand the picked one to the OS share
  // sheet). Someone else's session skips straight to the link share. The
  // fetch itself starts right here, in this click handler — not in an effect
  // owned by the sheet — so it fires exactly once per tap regardless of
  // StrictMode, and (when prefetchShareImage already warmed it) usually
  // just reuses the already-in-flight/resolved request.
  const handleShare = () => {
    if (!isOwner) {
      handleShareLink();
      return;
    }
    ensureShareFetch();
    setShareSheetOpen(true);
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
        href={`/sessions/${sessionId}#comments`}
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
        <ShareSheet
          shareText={shareText}
          sessionId={sessionId}
          variants={shareVariants}
          ready={shareReady}
          onClose={() => setShareSheetOpen(false)}
        />
      )}
    </div>
  );
}
