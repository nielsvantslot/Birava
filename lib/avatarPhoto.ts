import path from "path";
import { PhotoUploadServiceFactory } from "@/modules/photo-upload/services/PhotoUploadServiceFactory";
import { SharpImageProcessor } from "@/modules/photo-upload/services/SharpImageProcessor";
import { LocalDiskStorageAdapter } from "@/modules/photo-upload/adapters/LocalDiskStorageAdapter";
import { VercelBlobStorageAdapter } from "@/modules/photo-upload/adapters/VercelBlobStorageAdapter";
import { VercelBlobDirectUploadCoordinator } from "@/modules/photo-upload/adapters/VercelBlobDirectUploadCoordinator";
import type { IStorageAdapter } from "@/modules/photo-upload/adapters/IStorageAdapter";
import type { IDirectUploadCoordinator } from "@/modules/photo-upload/adapters/IDirectUploadCoordinator";
import {
  AVATAR_BLOB_ACCESS,
  AVATAR_MAX_DIMENSION,
  AVATAR_MAX_UPLOAD_BYTES,
  avatarKeyPrefix,
} from "@/lib/avatarPhotoConfig";

/**
 * Composition root for profile-avatar storage — mirrors DrinkPhotoStorageFactory
 * (lib/photoUpload.ts) one-for-one, but picks a *public* blob backend: unlike
 * check-in photos (private blob, served through the auth-gated /api/photos
 * route), avatars render as plain `<img src={avatarUrl}>` everywhere (header,
 * session cards, …), so they must be publicly reachable. Local dev still
 * writes to public/uploads (statically served, already public), same as
 * check-in photos in dev.
 */
class AvatarPhotoStorageFactory {
  static createStorageAdapter(): IStorageAdapter {
    if (process.env.NODE_ENV === "production") {
      return new VercelBlobStorageAdapter({ access: AVATAR_BLOB_ACCESS });
    }
    return new LocalDiskStorageAdapter({
      rootDir: path.join(process.cwd(), "public", "uploads"),
      publicPathPrefix: "/uploads",
    });
  }

  static createDirectUploadCoordinator(): IDirectUploadCoordinator | undefined {
    // Local disk has no direct-upload capability — only wire this up where it
    // exists. Without it, the raw file travels through this route's request
    // body even in production, where Vercel Functions cap that at ~4.5MB —
    // small enough that an ordinary phone photo (routinely 5-10MB, under
    // AVATAR_MAX_UPLOAD_BYTES) gets rejected by the platform before this code
    // ever runs.
    return process.env.NODE_ENV === "production" ? new VercelBlobDirectUploadCoordinator() : undefined;
  }
}

/** Avatars: center-cropped to a 512px square, re-encoded WebP, EXIF stripped, no LQIP. */
export const avatarPhotoService = PhotoUploadServiceFactory.create({
  storage: AvatarPhotoStorageFactory.createStorageAdapter(),
  imageProcessor: new SharpImageProcessor({
    maxDimension: AVATAR_MAX_DIMENSION,
    fit: "cover",
    quality: 82,
    format: "webp",
    lqip: false,
    maxInputBytes: AVATAR_MAX_UPLOAD_BYTES,
  }),
  directUpload: AvatarPhotoStorageFactory.createDirectUploadCoordinator(),
  maxUploadBytes: AVATAR_MAX_UPLOAD_BYTES,
  keyPrefix: avatarKeyPrefix,
});
