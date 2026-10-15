import { PhotoUploadServiceFactory } from "@/modules/photo-upload/services/PhotoUploadServiceFactory";
import { SharpImageProcessor } from "@/modules/photo-upload/services/SharpImageProcessor";
import { StorageAdapterFactory } from "@/modules/media/server/storageAdapterFactory";
import { DRINK_PHOTO_MAX_DIMENSION, DRINK_PHOTO_MAX_UPLOAD_BYTES, drinkPhotoKeyPrefix } from "@/modules/media/domain/photoUploadConfig";

/** Check-in photos: resized to 1600px, re-encoded WebP, EXIF stripped, tiny blur LQIP. */
export const drinkPhotoService = PhotoUploadServiceFactory.create({
  storage: StorageAdapterFactory.create(),
  imageProcessor: new SharpImageProcessor({
    maxDimension: DRINK_PHOTO_MAX_DIMENSION,
    quality: 80,
    format: "webp",
    lqip: { width: 16, quality: 40 },
    maxInputBytes: DRINK_PHOTO_MAX_UPLOAD_BYTES,
  }),
  directUpload: StorageAdapterFactory.createDirectUploadCoordinator(),
  maxUploadBytes: DRINK_PHOTO_MAX_UPLOAD_BYTES,
  keyPrefix: drinkPhotoKeyPrefix,
});
