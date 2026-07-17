"use client";

import { useRef, useState } from "react";
import { showToast } from "@/components/ui/toast-pill";
import { cn } from "@/lib/utils";

export type ShareVariant = {
  key: "opaque" | "transparent";
  label: string;
  dataUri: string;
  file: File;
};

/**
 * Strava-style share preview: swipe between recap image variants, then hand
 * the currently-selected one to the OS share sheet (or download it). Purely
 * presentational — fetching/decoding the variants is owned by the parent
 * (components/drink/social-row.tsx's SocialActs), so the same in-flight/
 * cached request can be reused whether it was kicked off by a prefetch on
 * page load or by the Share tap that opened this sheet. The eventual Share
 * tap never awaits a fetch before calling navigator.share() — iOS Safari
 * drops the share sheet's user-activation the instant an await runs first.
 */
export function ShareSheet({
  sessionId,
  shareText,
  variants,
  ready,
  onClose,
}: {
  sessionId: string;
  /** Fallback text (+ session link) used when the recap image can't be generated. */
  shareText: string;
  variants: ShareVariant[] | null;
  ready: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [sharing, setSharing] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    // Clamped — iOS Safari's elastic overscroll can push scrollLeft past
    // either end of the track (negative, or beyond the last slide), which
    // would otherwise index out of range and blank the label/current file.
    const raw = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(Math.max(0, Math.min((variants?.length ?? 1) - 1, raw)));
  };

  const goTo = (i: number) => {
    trackRef.current?.scrollTo({ left: i * trackRef.current.clientWidth, behavior: "smooth" });
  };

  const current = variants?.[index];

  // Guaranteed fallback if the recap image couldn't be generated at all
  // (network blip, server error) — share a text + link instead of leaving
  // the user stuck with no way to complete the share.
  const shareLinkFallback = async () => {
    const url = `${window.location.origin}/sessions/${sessionId}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText, url });
      } catch {
        /* user cancelled */
      }
      return;
    }
    await navigator.clipboard.writeText(`${shareText} ${url}`);
    showToast("Copied to clipboard");
  };

  const handleShare = async () => {
    if (sharing || !ready) return;
    const file = current?.file;
    if (!file) {
      await shareLinkFallback();
      onClose();
      return;
    }
    setSharing(true);
    try {
      if (navigator.canShare?.({ files: [file] })) {
        // Files only, no text/title — Snapchat and some other iOS share
        // targets silently drop the image when text is combined with a file.
        await navigator.share({ files: [file] });
        onClose();
        return;
      }
      const downloadUrl = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      showToast("Image downloaded");
      onClose();
    } catch {
      /* user cancelled the share sheet */
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="share-sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span>Share session</span>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="share-track" ref={trackRef} onScroll={handleScroll}>
          {(variants ?? []).map((v) => (
            <div className="share-slide" key={v.key}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.dataUri} alt={`${v.label} preview`} className="share-preview" />
            </div>
          ))}
          {!variants && (
            <div className="share-slide">
              <div className="share-preview share-preview-loading">
                {ready ? "Couldn't generate this image" : "Preparing…"}
              </div>
            </div>
          )}
        </div>

        {variants && (
          <div className="share-picker">
            <div className="share-dots">
              {variants.map((v, i) => (
                <button
                  key={v.key}
                  className={cn("share-dot", i === index && "on")}
                  onClick={() => goTo(i)}
                  aria-label={`Show ${v.label}`}
                />
              ))}
            </div>
            <div className="share-variant-label">{current?.label}</div>
          </div>
        )}

        <button
          className="btn btn-primary share-cta"
          onClick={handleShare}
          disabled={!ready || sharing}
        >
          {sharing ? "Sharing…" : !ready ? "Preparing…" : "Share"}
        </button>
      </div>
    </div>
  );
}
