import path from "path";
import { PhotoUploadServiceFactory } from "@/modules/photo-upload/services/PhotoUploadServiceFactory";
import { SharpImageProcessor } from "@/modules/photo-upload/services/SharpImageProcessor";
import { LocalDiskStorageAdapter } from "@/modules/photo-upload/adapters/LocalDiskStorageAdapter";
import { VercelBlobStorageAdapter } from "@/modules/photo-upload/adapters/VercelBlobStorageAdapter";
import { VercelBlobDirectUploadCoordinator } from "@/modules/photo-upload/adapters/VercelBlobDirectUploadCoordinator";
import type { IDirectUploadCoordinator } from "@/modules/photo-upload/adapters/IDirectUploadCoordinator";
import type { IStorageAdapter } from "@/modules/photo-upload/adapters/IStorageAdapter";
import { DRINK_PHOTO_MAX_DIMENSION, DRINK_PHOTO_MAX_UPLOAD_BYTES, drinkPhotoKeyPrefix } from "@/lib/photoUploadConfig";

/**
 * Composition root for check-in photo storage — picks the concrete
 * IStorageAdapter/IDirectUploadCoordinator for the current environment. This
 * environment-branching decision is deliberately app-level code, not part of
 * the reusable modules/photo-upload module.
 *
 * `next dev` (including inside docker-compose) always runs with
 * NODE_ENV=development, so local development stays on-disk and never
 * touches Blob storage. Vercel builds set NODE_ENV=production for both the
 * production and staging/preview deployments.
 */
class DrinkPhotoStorageFactory {
  static createStorageAdapter(): IStorageAdapter {
    if (process.env.NODE_ENV === "production") {
      return new VercelBlobStorageAdapter({ access: "private" });
    }
    return new LocalDiskStorageAdapter({
      rootDir: path.join(process.cwd(), "public", "uploads"),
      publicPathPrefix: "/uploads",
    });
  }

  static createDirectUploadCoordinator(): IDirectUploadCoordinator | undefined {
    // Local disk has no direct-upload capability — only wire this up where it exists.
    return process.env.NODE_ENV === "production" ? new VercelBlobDirectUploadCoordinator() : undefined;
  }
}

/** Check-in photos: resized to 1600px, re-encoded WebP, EXIF stripped, tiny blur LQIP. */
export const drinkPhotoService = PhotoUploadServiceFactory.create({
  storage: DrinkPhotoStorageFactory.createStorageAdapter(),
  imageProcessor: new SharpImageProcessor({
    maxDimension: DRINK_PHOTO_MAX_DIMENSION,
    quality: 80,
    format: "webp",
    lqip: { width: 16, quality: 40 },
    maxInputBytes: DRINK_PHOTO_MAX_UPLOAD_BYTES,
  }),
  directUpload: DrinkPhotoStorageFactory.createDirectUploadCoordinator(),
  maxUploadBytes: DRINK_PHOTO_MAX_UPLOAD_BYTES,
  keyPrefix: drinkPhotoKeyPrefix,
});
