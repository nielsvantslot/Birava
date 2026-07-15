"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/components/ui/toast-pill";
import { cn } from "@/lib/utils";

type VariantKey = "opaque" | "transparent";

type Variant = {
  key: VariantKey;
  label: string;
  file: File | null;
  url: string | null;
};

const VARIANTS: Array<{ key: VariantKey; label: string }> = [
  { key: "opaque", label: "Card" },
  { key: "transparent", label: "Sticker" },
];

/**
 * Strava-style share preview: swipe between recap image variants, then hand
 * the currently-selected one to the OS share sheet (or download it). Both
 * variants are pre-fetched as soon as the sheet opens so the eventual Share
 * tap never awaits a fetch before calling navigator.share() — iOS Safari
 * drops the share sheet's user-activation the instant an await runs first.
 */
export function ShareSheet({
  entryId,
  onClose,
}: {
  entryId: string;
  onClose: () => void;
}) {
  const [variants, setVariants] = useState<Variant[]>(
    VARIANTS.map((v) => ({ ...v, file: null, url: null }))
  );
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];

    Promise.all(
      VARIANTS.map(async ({ key, label }) => {
        try {
          const res = await fetch(`/api/sessions/${entryId}/share-image?variant=${key}`);
          if (!res.ok) return { key, label, file: null, url: null };
          const blob = await res.blob();
          const file = new File([blob], `birava-session-${key}.png`, { type: "image/png" });
          const url = URL.createObjectURL(file);
          urls.push(url);
          return { key, label, file, url };
        } catch {
          return { key, label, file: null, url: null };
        }
      })
    ).then((next) => {
      if (cancelled) return;
      setVariants(next);
      setReady(true);
    });

    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [entryId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants.length]);

  const step = (delta: number) =>
    setIndex((i) => (i + delta + variants.length) % variants.length);

  const current = variants[index];

  const handleShare = async () => {
    if (sharing || !ready) return;
    const file = current?.file;
    if (!file) {
      showToast("Could not generate this image");
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
    <div className="lightbox share-sheet" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      {variants.length > 1 && (
        <button
          className="lightbox-nav prev"
          onClick={(e) => {
            e.stopPropagation();
            step(-1);
          }}
          aria-label="Previous version"
        >
          ‹
        </button>
      )}
      <figure onClick={(e) => e.stopPropagation()}>
        {current?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url} alt={`${current.label} share preview`} className="share-preview" />
        ) : (
          <div className="lightbox-card">
            <b>{ready ? "Couldn't generate this image" : "Preparing…"}</b>
          </div>
        )}
        <div className="share-dots">
          {variants.map((v, i) => (
            <span key={v.key} className={cn("share-dot", i === index && "on")} />
          ))}
        </div>
        <figcaption>{current?.label}</figcaption>
        <button
          className="btn btn-primary share-cta"
          onClick={handleShare}
          disabled={!ready || sharing}
        >
          {sharing ? "Sharing…" : !ready ? "Preparing…" : "Share"}
        </button>
      </figure>
      {variants.length > 1 && (
        <button
          className="lightbox-nav next"
          onClick={(e) => {
            e.stopPropagation();
            step(1);
          }}
          aria-label="Next version"
        >
          ›
        </button>
      )}
    </div>
  );
}
