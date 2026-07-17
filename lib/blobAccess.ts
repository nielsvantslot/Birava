/**
 * The one Blob access level every composition root in this app uses — check-in
 * photos, avatars, and share images are all private, served only through an
 * auth-gated proxy route (/api/photos, /api/avatars) rather than a raw stored
 * URL. No server-only imports here, so it can be shared with client-side
 * upload-endpoint config (lib/photoUploadConfig.ts, lib/avatarPhotoConfig.ts)
 * as well as the server-only StorageAdapterFactory.
 */
export const PRIVATE_BLOB_ACCESS = "private" as const;
