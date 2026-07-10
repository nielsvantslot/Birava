"use client";

import { useCallback, useEffect, useState } from "react";
import { drinkPhotoSrc } from "@/lib/utils";

export type CheckinTile = {
  id: string;
  /** Splits numbering — the check-in's position in the session. */
  order: number;
  /** Drink name (or type fallback) — shown on every tile and as the lightbox title. */
  title: string;
  /** Short "venue · time" line — shown on every tile, photo or not. */
  sub: string;
  /** Full "drink · venue · time" line — shown in the lightbox. */
  caption: string;
  hasPhoto: boolean;
  /** Edit link, only for the session owner. */
  editHref: string | null;
};

export function CheckinGrid({ items }: { items: CheckinTile[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((i) =>
        i === null ? i : (i + delta + items.length) % items.length
      ),
    [items.length]
  );

  useEffect(() => {
    if (openIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, close, step]);

  if (items.length === 0) return null;

  const current = openIndex !== null ? items[openIndex] : null;

  return (
    <>
      <div className="checkin-grid">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className="grid-item"
            onClick={() => setOpenIndex(i)}
            aria-label={`View check-in: ${item.caption}`}
          >
            <span className="grid-item-badge">{item.order}</span>
            {item.hasPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={drinkPhotoSrc(item.id)}
                alt={item.caption}
                loading="lazy"
                decoding="async"
              />
            )}
            <span className="grid-item-caption">
              <b>{item.title}</b>
              <span>{item.sub}</span>
            </span>
          </button>
        ))}
      </div>

      {current && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <button
            className="lightbox-close"
            onClick={close}
            aria-label="Close"
          >
            ×
          </button>
          {items.length > 1 && (
            <button
              className="lightbox-nav prev"
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              aria-label="Previous check-in"
            >
              ‹
            </button>
          )}
          <figure onClick={(e) => e.stopPropagation()}>
            {current.hasPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={drinkPhotoSrc(current.id)} alt={current.caption} />
            ) : (
              <div className="lightbox-card">
                <b>{current.title}</b>
                <span>{current.sub}</span>
              </div>
            )}
            <figcaption>
              {current.caption}
              {current.editHref && (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={current.editHref}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Edit
                  </a>
                </>
              )}
            </figcaption>
          </figure>
          {items.length > 1 && (
            <button
              className="lightbox-nav next"
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              aria-label="Next check-in"
            >
              ›
            </button>
          )}
        </div>
      )}
    </>
  );
}
