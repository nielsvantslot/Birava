"use client";

import { useEffect, useRef, useState } from "react";
import { showToast } from "@/components/ui/toast-pill";
import { cn } from "@/lib/utils";

type VariantKey = "opaque" | "transparent";

type Variant = {
  key: VariantKey;
  label: string;
  dataUri: string | null;
  file: File | null;
};

const LABELS: Record<VariantKey, string> = { opaque: "Card", transparent: "Sticker" };

async function dataUriToFile(dataUri: string, filename: string): Promise<File> {
  const res = await fetch(dataUri);
  const blob = await res.blob();
  return new File([blob], filename, { type: "image/png" });
}

/**
 * Strava-style share preview: swipe between recap image variants, then hand
 * the currently-selected one to the OS share sheet (or download it). Both
 * variants come back from one request (the server computes the shared map
 * once — see the route) and are decoded to Files immediately, so the eventual
 * Share tap never awaits a fetch before calling navigator.share() — iOS
 * Safari drops the share sheet's user-activation the instant an await runs
 * first.
 */
export function ShareSheet({
  entryId,
  onClose,
}: {
  entryId: string;
  onClose: () => void;
}) {
  const [variants, setVariants] = useState<Variant[]>([
    { key: "opaque", label: LABELS.opaque, dataUri: null, file: null },
    { key: "transparent", label: LABELS.transparent, dataUri: null, file: null },
  ]);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [sharing, setSharing] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(`/api/sessions/${entryId}/share-image`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data: { opaque: string; transparent: string } | null) => {
        if (cancelled || !data) return;
        const [opaqueFile, transparentFile] = await Promise.all([
          dataUriToFile(data.opaque, "birava-session-card.png"),
          dataUriToFile(data.transparent, "birava-session-sticker.png"),
        ]);
        if (cancelled) return;
        setVariants([
          { key: "opaque", label: LABELS.opaque, dataUri: data.opaque, file: opaqueFile },
          { key: "transparent", label: LABELS.transparent, dataUri: data.transparent, file: transparentFile },
        ]);
      })
      .catch(() => {
        /* aborted, or generation failed — the sheet shows "couldn't generate" and Share stays disabled */
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [entryId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const goTo = (i: number) => {
    trackRef.current?.scrollTo({ left: i * trackRef.current.clientWidth, behavior: "smooth" });
  };

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
          {variants.map((v) => (
            <div className="share-slide" key={v.key}>
              {v.dataUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.dataUri} alt={`${v.label} preview`} className="share-preview" />
              ) : (
                <div className="share-preview share-preview-loading">
                  {ready ? "Couldn't generate this image" : "Preparing…"}
                </div>
              )}
            </div>
          ))}
        </div>

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
