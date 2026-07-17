import path from "path";
import { PhotoUploadServiceFactory } from "@/modules/photo-upload/services/PhotoUploadServiceFactory";
import { SharpImageProcessor } from "@/modules/photo-upload/services/SharpImageProcessor";
import { LocalDiskStorageAdapter } from "@/modules/photo-upload/adapters/LocalDiskStorageAdapter";
import { VercelBlobStorageAdapter } from "@/modules/photo-upload/adapters/VercelBlobStorageAdapter";
import type { IStorageAdapter } from "@/modules/photo-upload/adapters/IStorageAdapter";
import { AVATAR_MAX_DIMENSION, AVATAR_MAX_UPLOAD_BYTES, avatarKeyPrefix } from "@/lib/avatarPhotoConfig";

/**
 * Composition root for profile-avatar storage. Unlike check-in photos (private
 * blob, served through the auth-gated /api/photos route), avatars render as
 * plain `<img src={avatarUrl}>` everywhere (header, session cards, …), so they
 * must be publicly reachable — hence a *public* blob backend, not the private
 * one StorageAdapterFactory hands out. Local dev still writes to public/uploads
 * (statically served, already public), same as check-in photos in dev.
 */
function createAvatarStorage(): IStorageAdapter {
  if (process.env.NODE_ENV === "production") {
    return new VercelBlobStorageAdapter({ access: "public" });
  }
  return new LocalDiskStorageAdapter({
    rootDir: path.join(process.cwd(), "public", "uploads"),
    publicPathPrefix: "/uploads",
  });
}

/** Avatars: center-cropped to a 512px square, re-encoded WebP, EXIF stripped, no LQIP. */
export const avatarPhotoService = PhotoUploadServiceFactory.create({
  storage: createAvatarStorage(),
  imageProcessor: new SharpImageProcessor({
    maxDimension: AVATAR_MAX_DIMENSION,
    fit: "cover",
    quality: 82,
    format: "webp",
    lqip: false,
    maxInputBytes: AVATAR_MAX_UPLOAD_BYTES,
  }),
  maxUploadBytes: AVATAR_MAX_UPLOAD_BYTES,
  keyPrefix: avatarKeyPrefix,
});
