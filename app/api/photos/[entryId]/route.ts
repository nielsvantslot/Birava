import crypto from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { readBeerPhoto } from "@/lib/storage";

async function canViewEntry(entry: { userId: string; groupId: string | null }, viewerId: string) {
  if (entry.userId === viewerId) return true;

  if (entry.groupId) {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: entry.groupId, userId: viewerId } },
    });
    if (membership) return true;
  }

  const follow = await db.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: entry.userId } },
  });
  return follow !== null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not authenticated", { status: 401 });

  const { entryId } = await params;
  const entry = await db.beerEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, groupId: true, photoUrl: true },
  });

  if (!entry || !entry.photoUrl) return new Response("Not found", { status: 404 });

  const allowed = await canViewEntry(entry, user.id);
  if (!allowed) return new Response("Not found", { status: 404 });

  // The bytes behind a given photoUrl never change (an edit swaps in a new
  // URL), so the URL is a perfect content validator. Hashing it also lets an
  // edited check-in bust the cache under the same /api/photos/[entryId] URL.
  const etag = `"${crypto.createHash("sha1").update(entry.photoUrl).digest("hex")}"`;
  const cacheControl = "private, max-age=86400";

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": cacheControl },
    });
  }

  const photo = await readBeerPhoto(entry.photoUrl);
  if (!photo) return new Response("Not found", { status: 404 });

  return new Response(photo.stream, {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": cacheControl,
      ETag: etag,
    },
  });
}
