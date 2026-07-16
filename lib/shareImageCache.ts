import path from "path";
import { LocalDiskStorageAdapter } from "@/modules/photo-upload/adapters/LocalDiskStorageAdapter";
import { VercelBlobStorageAdapter } from "@/modules/photo-upload/adapters/VercelBlobStorageAdapter";
import { StreamBufferConverter } from "@/modules/photo-upload/StreamBufferConverter";
import type { IStorageAdapter } from "@/modules/photo-upload/adapters/IStorageAdapter";

/**
 * Composition root for caching rendered session share images (see
 * app/api/sessions/[id]/share-image/route.tsx). Reuses the same
 * IStorageAdapter backends as check-in photos (lib/photoUpload.ts) — local
 * disk in dev, Vercel Blob in production — as its own storage, since share
 * images have none of the resize/HEIC/LQIP needs PhotoUploadService exists
 * for; this just needs put/get/del of an already-finished PNG buffer.
 */
function createStorageAdapter(): IStorageAdapter {
  if (process.env.NODE_ENV === "production") {
    return new VercelBlobStorageAdapter({ access: "private" });
  }
  return new LocalDiskStorageAdapter({
    rootDir: path.join(process.cwd(), "public", "uploads"),
    publicPathPrefix: "/uploads",
  });
}

const storage = createStorageAdapter();
const KEY_PREFIX = "share-images";

function pngFile(buffer: Buffer, name: string): File {
  return new File([Uint8Array.from(buffer)], name, { type: "image/png" });
}

/**
 * Persists both rendered variants at a fixed, session-scoped key (not a
 * random one) — a regeneration overwrites the previous render in place
 * rather than accumulating orphaned blobs, since only the latest render for
 * a session is ever valid.
 */
async function store(
  sessionId: string,
  opaque: Buffer,
  transparent: Buffer
): Promise<{ opaqueUrl: string; transparentUrl: string }> {
  const [{ url: opaqueUrl }, { url: transparentUrl }] = await Promise.all([
    storage.put(`${KEY_PREFIX}/${sessionId}/opaque.png`, pngFile(opaque, "opaque.png")),
    storage.put(`${KEY_PREFIX}/${sessionId}/transparent.png`, pngFile(transparent, "transparent.png")),
  ]);
  return { opaqueUrl, transparentUrl };
}

async function read(url: string): Promise<Buffer | null> {
  const stored = await storage.get(url);
  if (!stored) return null;
  return StreamBufferConverter.toBuffer(stored.stream);
}

/**
 * Best-effort delete for a session whose cache will never be regenerated
 * (its DrinkSession row is being deleted or merged away) — ordinary
 * invalidation doesn't need this, since nulling the DB fields already makes
 * the cache a miss and the next generation overwrites the same key.
 */
async function remove(url: string | null | undefined): Promise<void> {
  if (!url) return;
  await storage.del(url);
}

export const shareImageCache = { store, read, remove };
