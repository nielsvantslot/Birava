import { PhotoUploadServiceFactory } from "@/modules/photo-upload/services/PhotoUploadServiceFactory";
import { SharpImageProcessor } from "@/modules/photo-upload/services/SharpImageProcessor";
import { VercelBlobDirectUploadCoordinator } from "@/modules/photo-upload/adapters/VercelBlobDirectUploadCoordinator";
import type { IDirectUploadCoordinator } from "@/modules/photo-upload/adapters/IDirectUploadCoordinator";
import type { IStorageAdapter } from "@/modules/photo-upload/adapters/IStorageAdapter";
import { StorageAdapterFactory } from "@/lib/storageAdapterFactory";
import { DRINK_PHOTO_MAX_DIMENSION, DRINK_PHOTO_MAX_UPLOAD_BYTES, drinkPhotoKeyPrefix } from "@/lib/photoUploadConfig";

/**
 * Composition root for check-in photo storage — the storage backend itself
 * comes from the shared StorageAdapterFactory; this factory only adds the
 * direct-upload coordinator decision, which is check-in-photo-specific (share
 * images, for instance, are server-rendered and never need one).
 *
 * `next dev` (including inside docker-compose) always runs with
 * NODE_ENV=development, so local development stays on-disk and never
 * touches Blob storage. Vercel builds set NODE_ENV=production for both the
 * production and staging/preview deployments.
 */
class DrinkPhotoStorageFactory {
  static createStorageAdapter(): IStorageAdapter {
    return StorageAdapterFactory.create();
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
