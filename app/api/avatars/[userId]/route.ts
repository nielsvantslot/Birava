import { z } from "zod";
import crypto from "crypto";
import { ApiError } from "@/lib/gateway/ApiError";
import { gateway } from "@/modules/identity/server/gateway";
import { avatarPhotoService } from "@/modules/media/server/avatarPhoto";
import { getViewableAvatarUrl } from "@/modules/identity/server/userQueries";

// Avatars are stored private (mirrors check-in photos, /api/photos/[entryId])
// — a browser can't fetch a private blob directly, so every <img> renders
// through this proxy instead of the raw stored URL (see lib/utils.ts's
// avatarSrc). Unlike /api/photos/[entryId] (a fresh URL per edit, so
// `immutable` is safe there), this URL is permanent per user and its content
// changes on every re-upload — `no-cache` forces a conditional revalidation
// on every request (cheap: a 304 via the ETag below when nothing changed)
// instead of `immutable` silently serving a stale cached avatar for a year.
const CACHE_CONTROL = "private, no-cache";

export const GET = gateway.route.authed(
  { name: "avatars.get", params: z.object({ userId: z.string().min(1) }) },
  async ({ request, input }) => {
    const { userId } = input.params;

    const avatarUrl = await getViewableAvatarUrl(userId);
    if (!avatarUrl) throw ApiError.notFound();

    const etag = `"${crypto.createHash("sha1").update(avatarUrl).digest("hex")}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": CACHE_CONTROL },
      });
    }

    const photo = await avatarPhotoService.read(avatarUrl);
    if (!photo) throw ApiError.notFound();

    return new Response(photo.stream, {
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": CACHE_CONTROL,
        ETag: etag,
      },
    });
  }
);
