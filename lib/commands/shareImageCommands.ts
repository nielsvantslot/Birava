import sharp from "sharp";
import { getSession } from "@/lib/controllers/drinkController";
import { getShareImageCache, getSessionOwnerId } from "@/lib/queries/drinkSessionQueries";
import { cacheShareImages } from "@/lib/commands/drinkSessionCommands";
import {
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
import { shareImageCache } from "@/lib/shareImageCache";
import { MAP_HEIGHT, MAP_WIDTH, renderShareImageCard, type ShareImageStat } from "@/lib/render/shareImageCard";
import { ShareImageDTO } from "@/lib/dtos";

/**
 * Builds this feature's response DTO for both the cache-hit and
 * freshly-rendered paths below. `opaqueMime` isn't always "image/jpeg" — a
 * session cached before the JPEG re-encode shipped still points at an
 * `opaque.png` blob, and mislabeling those bytes would break client-side
 * decoding, so the cache-hit caller sniffs the stored URL's extension
 * instead of assuming.
 */
function buildShareImageDTO(opaque: Buffer, opaqueMime: string, transparent: Buffer): ShareImageDTO {
  return {
    opaque: `data:${opaqueMime};base64,${opaque.toString("base64")}`,
    transparent: `data:image/png;base64,${transparent.toString("base64")}`,
  };
}

/** Whether `userId` is allowed to render/view this session's share image — the only session-specific authorization check this feature needs. */
export async function canRenderShareImage(userId: string, sessionId: string): Promise<boolean> {
  const ownerId = await getSessionOwnerId(sessionId);
  return ownerId === userId;
}

/**
 * The session share image feature's full orchestration: serve a cached
 * render if the session hasn't changed since, otherwise render both card
 * variants fresh and persist them for next time. Returns `null` if the
 * session doesn't exist (caller has already confirmed ownership via
 * `canRenderShareImage` before calling this).
 */
export async function getShareImageForSession(sessionId: string): Promise<ShareImageDTO | null> {
  // Cache hit: this session's entries/name haven't changed since it was last
  // generated (every command that changes them nulls these fields out — see
  // lib/commands/drinkEntryCommands.ts / drinkSessionCommands.ts), so skip
  // the full session load, tile fetch, sharp compositing, and Satori renders.
  const cached = await getShareImageCache(sessionId);
  if (cached) {
    const [opaque, transparent] = await Promise.all([
      shareImageCache.read(cached.opaqueUrl),
      shareImageCache.read(cached.transparentUrl),
    ]);
    if (opaque && transparent) {
      const opaqueMime = cached.opaqueUrl.endsWith(".png") ? "image/png" : "image/jpeg";
      return buildShareImageDTO(opaque, opaqueMime, transparent);
    }
    // Blobs vanished from storage despite the DB still pointing at them —
    // fall through and regenerate rather than failing.
  }

  // Cache miss — now load the full session (all check-ins) needed to render.
  const session = await getSession({ id: sessionId });
  if (!session) {
    return null;
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
    .filter((c): c is typeof c & { lat: number; lng: number } => c.lat != null && c.lng != null)
    .map((c) => ({ lat: c.lat, lng: c.lng }));

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

  const stats: ShareImageStat[] = [{ value: String(drinks), label: lone ? "drink" : "drinks" }];
  if (!lone) {
    stats.push({ value: formatSessionDuration(minutes), label: "duration" });
  }
  if (pace) {
    stats.push({ value: pace, label: "per drink" });
  }

  const [opaqueImg, transparentImg] = await Promise.all([
    renderShareImageCard({
      transparent: false,
      visualUri: mapDataUri ?? heroDataUri,
      title,
      venueLine,
      lone,
      stats,
    }),
    renderShareImageCard({
      transparent: true,
      visualUri: routeOnlyDataUri,
      title,
      venueLine,
      lone,
      stats,
    }),
  ]);

  const [opaquePngBuf, transparentBuf] = await Promise.all([
    opaqueImg.arrayBuffer(),
    transparentImg.arrayBuffer(),
  ]);
  // Satori (next/og's renderer) only emits PNG. That's fine for the
  // transparent sticker (route line only, no basemap — a few KB either way),
  // but the opaque card composites a rasterized basemap tile in, and PNG's
  // lossless encoding balloons a photographic image like that to multiple
  // MB. Re-encoding to JPEG here cuts it by 6-8x — this is the dominant cost
  // in the share sheet's "Preparing…" time on a real network, far more than
  // the render itself (which the DB-backed cache above already handles).
  const opaqueBytes = await sharp(Buffer.from(opaquePngBuf)).jpeg({ quality: 90 }).toBuffer();
  const transparentBytes = Buffer.from(transparentBuf);

  // Persist for next time — best-effort: a storage/DB hiccup here shouldn't
  // fail a request that already has its rendered images in hand.
  try {
    const { opaqueUrl, transparentUrl } = await shareImageCache.store(
      sessionId,
      opaqueBytes,
      transparentBytes
    );
    await cacheShareImages(sessionId, opaqueUrl, transparentUrl);
  } catch {
    /* served below regardless; just won't be cached for the next request */
  }

  return buildShareImageDTO(opaqueBytes, "image/jpeg", transparentBytes);
}
