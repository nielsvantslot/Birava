/**
 * Plain config for profile-avatar uploads — no server-only imports, so it can
 * be shared with the client if needed (mirrors modules/media/domain/photoUploadConfig.ts).
 */
import { PRIVATE_BLOB_ACCESS } from "@/modules/media/domain/blobAccess";

/** Square edge, in px, avatars are cropped/encoded to — small; avatars never render large. */
export const AVATAR_MAX_DIMENSION = 512;

/** Upload size cap for an avatar (generous for a phone photo; server re-encodes it down anyway). */
export const AVATAR_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Storage layout + ownership convention for a given user's avatar. */
export function avatarKeyPrefix(userId: string): string {
  return `avatars/${userId}`;
}

/**
 * Picks the upload endpoints a `PhotoUploader.upload` call needs for
 * avatars — mirrors `drinkPhotoUploadEndpoints` (modules/media/domain/photoUploadConfig.ts).
 * Access is private, same one Blob store/strategy as check-in photos (see
 * modules/media/domain/blobAccess.ts) — a "public" access write was rejected by the deployed
 * Vercel Blob store with a CORS error on the direct-upload PUT. Every avatar
 * render now goes through the auth-gated /api/avatars/[userId] proxy
 * (lib/utils.ts's avatarSrc) instead of a raw stored URL, matching how
 * check-in photos serve through /api/photos.
 */
export function avatarUploadEndpoints(userId: string, supportsDirectUpload: boolean) {
  return supportsDirectUpload
    ? {
        mode: "direct" as const,
        tokenUrl: "/api/uploads/avatar/blob-token",
        finalizeUrl: "/api/uploads/avatar/finalize",
        keyPrefix: avatarKeyPrefix(userId),
        access: PRIVATE_BLOB_ACCESS,
        // Mirrors drinkPhotoUploadEndpoints (modules/media/domain/photoUploadConfig.ts): a
        // direct-to-storage upload that hangs (reaches this app fine, can't
        // reach the storage provider's own domain) needs this so
        // PhotoUploader.uploadDirect can race it against a timeout and fall
        // back here instead of hanging forever. Avatars are already resized
        // to AVATAR_MAX_DIMENSION client-side, well under Vercel's request
        // body cap, so routing through this server is cheap.
        fallbackUploadUrl: "/api/uploads/avatar",
      }
    : { mode: "server" as const, uploadUrl: "/api/uploads/avatar" };
}
