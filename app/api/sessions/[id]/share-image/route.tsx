import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth/session";
import { getSessionCheckins } from "@/lib/controllers/drinkController";
import {
  findSessionWithCheckin,
  formatPace,
  formatSessionDuration,
  sessionMinutes,
  sessionSeconds,
  sessionTitle,
} from "@/lib/sessions";
import { getUserTimeZone } from "@/lib/timezone";
import { drinkPhotoService } from "@/lib/photoUpload";
import { StreamBufferConverter } from "@/modules/photo-upload/StreamBufferConverter";
import { renderSessionVisuals } from "@/lib/shareSessionMap";

// Prisma (getCurrentUser / history) and the storage layer need Node, not edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 9:16 — matches the pre-redesign share card's story-shaped ratio.
const WIDTH = 1080;
const HEIGHT = 1920;

const BG = "#0A0D09";
const INK = "#EEF2E7";
const INK_DIM = "#88907F";
const ACCENT = "#A9C641";
const LINE = "rgba(242, 238, 228, 0.12)";

const MAP_WIDTH = WIDTH - 144;
const MAP_HEIGHT = 1080;

/**
 * One stat's value + label pair. "column" stacks the value over the label
 * (used side-by-side under a map, a familiar footer-strip shape); "row" puts
 * the label beside the value (used stacked as a list when there's no map —
 * a row of small columns floating in empty space reads as cramped, a list
 * fills the space better).
 */
function renderStatPair(s: { value: string; label: string }, orientation: "column" | "row") {
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

function renderCard({
  transparent,
  visualUri,
  title,
  venueLine,
  lone,
  stats,
}: {
  transparent: boolean;
  visualUri: string | null;
  title: string;
  venueLine: string | null;
  lone: boolean;
  stats: Array<{ value: string; label: string }>;
}) {
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Recompute the session from its bounded ±48h window (the same path the
  // detail page uses) instead of scanning the caller's whole history.
  // getSessionCheckins is only login-gated, so the own-only rule is enforced
  // explicitly below; the client falls back to a text share on 404.
  const sessionWindow = await getSessionCheckins({ anchorId: id });
  const session = sessionWindow ? findSessionWithCheckin(sessionWindow, id) : null;
  if (!session || session.userId !== user.id) {
    return new Response("Not found", { status: 404 });
  }

  const tz = await getUserTimeZone();
  const title = sessionTitle(session, tz);
  const drinks = session.checkins.length;
  const minutes = sessionMinutes(session);
  const venues = session.venues;
  const venueLine =
    venues.length === 0
      ? null
      : venues.length === 1
        ? venues[0]
        : `${venues[0]} + ${venues.length - 1} more`;

  const routePoints = session.checkins
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => ({ lat: c.lat as number, lng: c.lng as number }));

  // Both variants' visuals are computed once, up front, and shared across the
  // two ImageResponse renders below — this used to be two independent GET
  // requests (one per variant), each re-fetching CARTO tiles and re-reading
  // the DB from scratch, which is why generating both was slow.
  //
  // Opaque card: full basemap + route (Strava-style), rasterized with sharp
  // (tile fetch + composite) since Satori can't render nested SVG.
  // Transparent sticker: route line only, no basemap tiles — a generic
  // basemap would look out of place composited onto the user's own photo,
  // and skipping the tile fetch makes this variant fast and network-free.
  // renderSessionVisuals computes the shared zoom/origin frame once for both.
  const { mapPng, routeOnlyPng } = await renderSessionVisuals(routePoints, MAP_WIDTH, MAP_HEIGHT);
  const mapDataUri = mapPng ? `data:image/png;base64,${mapPng.toString("base64")}` : null;
  const routeOnlyDataUri = routeOnlyPng
    ? `data:image/png;base64,${routeOnlyPng.toString("base64")}`
    : null;

  // Hero photo fallback — opaque card only. A transparent sticker with no
  // route just shows text/stats; embedding an opaque photo into it would
  // create a solid rectangle floating in transparency, defeating the point.
  let heroDataUri: string | null = null;
  if (!mapDataUri) {
    const heroCheckin = session.checkins.find((c) => c.photo_url);
    if (heroCheckin?.photo_url) {
      try {
        // Read bytes straight from storage, NOT the auth-gated /api/photos
        // route — a server-to-server fetch of that route carries no session
        // cookie and 401s (documented image-pipeline landmine).
        const photo = await drinkPhotoService.read(heroCheckin.photo_url);
        if (photo) {
          const buf = await StreamBufferConverter.toBuffer(photo.stream);
          // Satori can't decode WebP — every stored check-in photo is WebP
          // (lib/photoUpload.ts) — so re-encode to JPEG just for this embed
          // rather than switching the whole pipeline's storage format.
          const jpeg = await sharp(buf).jpeg({ quality: 85 }).toBuffer();
          heroDataUri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
        }
      } catch {
        /* no hero photo either — card still renders with stats only */
      }
    }
  }

  // A lone check-in has no span to measure at all — that's the only case
  // duration/pace are dropped. A real multi-check-in session still gets
  // both even if it happens to round to "0m" (checked in fast) — gating on
  // minutes > 0 previously hid them for any quick-succession session, which
  // read as the stats silently vanishing rather than "this was fast."
  const lone = drinks === 1;

  // Pace only makes sense with more than one drink — a deliberate,
  // share-card-only exception to the app's parked pace rule (see CLAUDE.md's
  // "Celebrate variety, never volume"). Computed from seconds, not the
  // already-rounded minute total, so a fast pace doesn't round down to "0m".
  const pace = !lone ? formatPace(Math.round(sessionSeconds(session) / drinks)) : null;

  const stats: Array<{ value: string; label: string }> = [
    { value: String(drinks), label: lone ? "drink" : "drinks" },
  ];
  if (!lone) {
    stats.push({ value: formatSessionDuration(minutes), label: "duration" });
  }
  if (pace) {
    stats.push({ value: pace, label: "per drink" });
  }

  const [opaqueImg, transparentImg] = await Promise.all([
    renderCard({
      transparent: false,
      visualUri: mapDataUri ?? heroDataUri,
      title,
      venueLine,
      lone,
      stats,
    }),
    renderCard({
      transparent: true,
      visualUri: routeOnlyDataUri,
      title,
      venueLine,
      lone,
      stats,
    }),
  ]);

  const [opaqueBuf, transparentBuf] = await Promise.all([
    opaqueImg.arrayBuffer(),
    transparentImg.arrayBuffer(),
  ]);

  return Response.json({
    opaque: `data:image/png;base64,${Buffer.from(opaqueBuf).toString("base64")}`,
    transparent: `data:image/png;base64,${Buffer.from(transparentBuf).toString("base64")}`,
  });
}
