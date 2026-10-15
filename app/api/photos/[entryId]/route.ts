import { z } from "zod";
import crypto from "crypto";
import sharp from "sharp";
import { ApiError } from "@/lib/gateway/ApiError";
import { gateway } from "@/modules/identity/server/gateway";
import { photoResizeQuery } from "@/modules/media/contract/uploadContract";
import { drinkPhotoService } from "@/modules/media/server/photoUpload";
import { StreamBufferConverter } from "@/modules/photo-upload/StreamBufferConverter";
import { getViewableDrinkPhotoUrl } from "@/modules/checkins/server/drinkEntryQueries";
import { HERO_WIDTHS, THUMB_WIDTH } from "@/modules/media/domain/photoSizes";

// The bytes behind a given photoUrl never change (see comment below), so
// this is safe to cache for a year without revalidation.
const CACHE_CONTROL = "private, max-age=31536000, immutable";
const RESIZE_QUALITY = 75;

type Resize = { width: number; cacheKey: string };

// `size=thumb` is the grid/feed tile's single fixed size. `w=<n>` backs the
// session card hero photo's custom next/image loader (session-card.tsx) —
// devices render that photo at different CSS widths, so one fixed size can
// never be right for all of them; `w` must be one of HERO_WIDTHS (mirrored
// into next.config.ts's images.deviceSizes) so next/image only ever
// requests widths this route actually serves. Anything else falls back to
// the full image rather than resizing to an unbounded, attacker-chosen size.
function parseResize(query: { size?: string; w?: string }): Resize | null {
  if (query.size === "thumb") {
    return { width: THUMB_WIDTH, cacheKey: "thumb" };
  }

  const w = Number(query.w);
  if (HERO_WIDTHS.includes(w)) {
    return { width: w, cacheKey: `w${w}` };
  }

  return null;
}

export const GET = gateway.route.authed(
  { name: "photos.get", params: z.object({ entryId: z.string().min(1) }), query: photoResizeQuery },
  async ({ request, input }) => {
    const { entryId } = input.params;
    const resize = parseResize(input.query);

    const photoUrl = await getViewableDrinkPhotoUrl(entryId);
    if (!photoUrl) throw ApiError.notFound();

    // The bytes behind a given photoUrl never change (an edit swaps in a new
    // URL), so the URL is a perfect content validator; hashing it also lets an
    // edited check-in bust the cache under the same /api/photos/[entryId] URL.
    // The resize variant is folded in so different sizes don't collide on one ETag.
    const etag = `"${crypto.createHash("sha1").update(`${photoUrl}:${resize?.cacheKey ?? "full"}`).digest("hex")}"`;

    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": CACHE_CONTROL },
      });
    }

    const photo = await drinkPhotoService.read(photoUrl);
    if (!photo) throw ApiError.notFound();

    if (!resize) {
      return new Response(photo.stream, {
        headers: {
          "Content-Type": photo.contentType,
          "Cache-Control": CACHE_CONTROL,
          ETag: etag,
        },
      });
    }

    const resizedBuffer = await sharp(await StreamBufferConverter.toBuffer(photo.stream))
      .resize({ width: resize.width, withoutEnlargement: true })
      .webp({ quality: RESIZE_QUALITY })
      .toBuffer();

    return new Response(new Uint8Array(resizedBuffer), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": CACHE_CONTROL,
        ETag: etag,
      },
    });
  }
);
