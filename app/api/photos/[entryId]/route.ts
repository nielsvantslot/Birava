import crypto from "crypto";
import { requireUser } from "@/lib/auth/requireUser";
import { readDrinkPhoto } from "@/lib/storage";
import { getViewableDrinkPhotoUrl } from "@/lib/queries/drinkEntryQueries";

const CACHE_CONTROL = "private, max-age=86400";

export const GET = requireUser<RouteContext<"/api/photos/[entryId]">>(
  async (request, user, { params }) => {
    const { entryId } = await params;

    const photoUrl = await getViewableDrinkPhotoUrl(user.id, entryId);
    if (!photoUrl) return new Response("Not found", { status: 404 });

    // The bytes behind a given photoUrl never change (an edit swaps in a new
    // URL), so the URL is a perfect content validator; hashing it also lets an
    // edited check-in bust the cache under the same /api/photos/[entryId] URL.
    const etag = `"${crypto.createHash("sha1").update(photoUrl).digest("hex")}"`;

    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": CACHE_CONTROL },
      });
    }

    const photo = await readDrinkPhoto(photoUrl);
    if (!photo) return new Response("Not found", { status: 404 });

    return new Response(photo.stream, {
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": CACHE_CONTROL,
        ETag: etag,
      },
    });
  }
);
