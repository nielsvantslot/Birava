import crypto from "crypto";
import sharp from "sharp";
import { requireUser } from "@/lib/auth/requireUser";
import { drinkPhotoService } from "@/lib/photoUpload";
import { StreamBufferConverter } from "@/modules/photo-upload/StreamBufferConverter";
import { getViewableDrinkPhotoUrl } from "@/lib/queries/drinkEntryQueries";
import { HERO_WIDTHS, THUMB_WIDTH } from "@/lib/photoSizes";

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
function parseResize(searchParams: URLSearchParams): Resize | null {
  if (searchParams.get("size") === "thumb") {
    return { width: THUMB_WIDTH, cacheKey: "thumb" };
  }

  const w = Number(searchParams.get("w"));
  if (HERO_WIDTHS.includes(w)) {
    return { width: w, cacheKey: `w${w}` };
  }

  return null;
}

export const GET = requireUser<RouteContext<"/api/photos/[entryId]">>(
  async (request, user, { params }) => {
    const { entryId } = await params;
    const resize = parseResize(new URL(request.url).searchParams);

    const photoUrl = await getViewableDrinkPhotoUrl(user.id, entryId);
    if (!photoUrl) return new Response("Not found", { status: 404 });

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
    if (!photo) return new Response("Not found", { status: 404 });

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
