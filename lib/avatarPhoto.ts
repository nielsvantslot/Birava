import { PhotoUploadServiceFactory } from "@/modules/photo-upload/services/PhotoUploadServiceFactory";
import { SharpImageProcessor } from "@/modules/photo-upload/services/SharpImageProcessor";
import { StorageAdapterFactory } from "@/lib/storageAdapterFactory";
import { AVATAR_MAX_DIMENSION, AVATAR_MAX_UPLOAD_BYTES, avatarKeyPrefix } from "@/lib/avatarPhotoConfig";

/** Avatars: center-cropped to a 512px square, re-encoded WebP, EXIF stripped, no LQIP. */
export const avatarPhotoService = PhotoUploadServiceFactory.create({
  storage: StorageAdapterFactory.create(),
  imageProcessor: new SharpImageProcessor({
    maxDimension: AVATAR_MAX_DIMENSION,
    fit: "cover",
    quality: 82,
    format: "webp",
    lqip: false,
    maxInputBytes: AVATAR_MAX_UPLOAD_BYTES,
  }),
  directUpload: StorageAdapterFactory.createDirectUploadCoordinator(),
  maxUploadBytes: AVATAR_MAX_UPLOAD_BYTES,
  keyPrefix: avatarKeyPrefix,
});
