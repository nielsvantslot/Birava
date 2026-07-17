/**
 * Plain config for profile-avatar uploads — no server-only imports, so it can
 * be shared with the client if needed (mirrors lib/photoUploadConfig.ts).
 */

/** Square edge, in px, avatars are cropped/encoded to — small; avatars never render large. */
export const AVATAR_MAX_DIMENSION = 512;

/** Upload size cap for an avatar (generous for a phone photo; server re-encodes it down anyway). */
export const AVATAR_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Storage layout + ownership convention for a given user's avatar. */
export function avatarKeyPrefix(userId: string): string {
  return `avatars/${userId}`;
}

/**
 * Blob access level avatars are stored/uploaded with — public, since avatars
 * render as plain `<img>` everywhere, unlike check-in photos' private blob.
 * The single source of truth for this: both `lib/avatarPhoto.ts`'s storage
 * adapter and `avatarUploadEndpoints` below read it from here, so the two
 * can't drift out of sync with each other.
 */
export const AVATAR_BLOB_ACCESS = "public" as const;

/**
 * Picks the upload endpoints a `PhotoUploader.upload` call needs for
 * avatars — mirrors `drinkPhotoUploadEndpoints` (lib/photoUploadConfig.ts).
 */
export function avatarUploadEndpoints(userId: string, supportsDirectUpload: boolean) {
  return supportsDirectUpload
    ? {
        mode: "direct" as const,
        tokenUrl: "/api/uploads/avatar/blob-token",
        finalizeUrl: "/api/uploads/avatar/finalize",
        keyPrefix: avatarKeyPrefix(userId),
        access: AVATAR_BLOB_ACCESS,
      }
    : { mode: "server" as const, uploadUrl: "/api/uploads/avatar" };
}
