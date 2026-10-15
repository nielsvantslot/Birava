import { ImageResponse } from "next/og";

// 9:16 — matches the pre-redesign share card's story-shaped ratio.
export const WIDTH = 1080;
export const HEIGHT = 1920;

const BG = "#0A0D09";
const INK = "#EEF2E7";
const INK_DIM = "#88907F";
const ACCENT = "#A9C641";
const LINE = "rgba(242, 238, 228, 0.12)";

export const MAP_WIDTH = WIDTH - 144;
export const MAP_HEIGHT = 1080;

export type ShareImageStat = { value: string; label: string };

/**
 * One stat's value + label pair. "column" stacks the value over the label
 * (used side-by-side under a map, a familiar footer-strip shape); "row" puts
 * the label beside the value (used stacked as a list when there's no map —
 * a row of small columns floating in empty space reads as cramped, a list
 * fills the space better).
 */
function renderStatPair(s: ShareImageStat, orientation: "column" | "row") {
  if (orientation === "column") {
    return (
      <div key={s.label} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, color: ACCENT }}>
          {s.value}
        </div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 30, color: INK_DIM }}>
          {s.label}
        </div>
      </div>
    );
  }
  return (
    <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 24 }}>
      <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: ACCENT }}>
        {s.value}
      </div>
      <div style={{ display: "flex", fontSize: 30, color: INK_DIM }}>{s.label}</div>
    </div>
  );
}

export type ShareImageCardInput = {
  transparent: boolean;
  visualUri: string | null;
  title: string;
  venueLine: string | null;
  lone: boolean;
  stats: ShareImageStat[];
};

/** Renders one variant (opaque card or transparent sticker) of the session share image as a PNG `ImageResponse`. */
export function renderShareImageCard({
  transparent,
  visualUri,
  title,
  venueLine,
  lone,
  stats,
}: ShareImageCardInput) {
  // Satori (next/og's renderer) doesn't support React.Fragment as a
  // transparent grouping wrapper — its layout engine needs every group to be
  // an explicit flex div, or siblings render as if they'd lost their parent's
  // flexDirection (text overlapping instead of stacking).
  //
  // `stretch` controls whether this block fills its parent's remaining space
  // (true, when there's a visual above it — needed so the stats row's
  // marginTop:"auto" has slack to push against and pins to the bottom) or
  // sizes to its own content (false, when there's no visual — so the parent's
  // justifyContent:"center" can center this block as a whole).
  function renderTextBlock(stretch: boolean) {
    return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        ...(stretch ? { flex: 1 } : { alignItems: "center", textAlign: "center" }),
      }}
    >
      <div
        style={{
          display: "flex",
          marginTop: stretch ? 56 : 0,
          fontSize: 64,
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        {title}
      </div>

      {venueLine && (
        <div style={{ display: "flex", marginTop: 20, fontSize: 34, color: INK_DIM }}>
          {venueLine}
        </div>
      )}

      {/* A lone check-in has no span to measure — say so instead of hiding the
          duration/pace stats silently, so the card doesn't read as broken. */}
      {lone && (
        <div style={{ display: "flex", marginTop: 20, fontSize: 30, color: INK_DIM }}>
          Single check-in
        </div>
      )}

      {stretch ? (
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            gap: 40,
            borderTop: `2px solid ${LINE}`,
            paddingTop: 48,
          }}
        >
          {stats.map((s) => renderStatPair(s, "column"))}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            marginTop: 56,
            borderTop: `2px solid ${LINE}`,
            paddingTop: 40,
          }}
        >
          {stats.map((s) => renderStatPair(s, "row"))}
        </div>
      )}
    </div>
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: transparent ? "transparent" : BG,
          color: INK,
          padding: 72,
        }}
      >
        {/* wordmark + kicker */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: ACCENT }}>
            Birava
          </div>
          <div style={{ display: "flex", fontSize: 28, color: INK_DIM }}>
            session recap
          </div>
        </div>

        {visualUri ? (
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            {/* route map (opaque card) / route line only (transparent sticker) / hero photo fallback */}
            <div
              style={{
                display: "flex",
                marginTop: 48,
                width: "100%",
                height: MAP_HEIGHT,
                borderRadius: 32,
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={visualUri}
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                style={{ objectFit: "cover", width: "100%", height: "100%" }}
                alt=""
              />
            </div>
            {renderTextBlock(true)}
          </div>
        ) : (
          // No route and no photo (e.g. a lone check-in with no location, or
          // location off entirely): there's no hero visual to anchor the
          // layout, so center the title/stats in the frame instead of
          // pinning them to the bottom and leaving a large empty gap above.
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
            }}
          >
            {renderTextBlock(false)}
          </div>
        )}

        {/* footer */}
        <div
          style={{
            display: "flex",
            marginTop: 48,
            justifyContent: "center",
            fontSize: 30,
            fontWeight: 700,
            color: INK,
          }}
        >
          birava.nl
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  );
}
