/**
 * Plain config shared between the server pipeline (lib/photoUpload.ts) and
 * the client upload form (components/drink/log-drink-form.tsx) — no `sharp`,
 * `fs`, or other server-only imports here, since this also gets bundled into
 * the client.
 */

/** Longest edge, in px, check-in photos are capped to — client pre-resize and server processing agree on this so the server rarely has to downscale further. */
export const DRINK_PHOTO_MAX_DIMENSION = 1600;

/** Client rejects an oversized file before attempting an upload; server enforces the same cap regardless. */
export const DRINK_PHOTO_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Storage layout + ownership convention for a given user's check-in photos — shared so the client's direct-upload pathname matches what the server validates against. */
export function drinkPhotoKeyPrefix(userId: string): string {
  return `entries-photos/${userId}`;
}

/**
 * Picks the upload endpoints a `PhotoUploader.upload` call needs for check-in
 * photos — shared between the log form (uploading fresh) and the offline
 * sync flush (uploading a queued photo later), so both agree on routes.
 */
export function drinkPhotoUploadEndpoints(userId: string, supportsDirectUpload: boolean) {
  return supportsDirectUpload
    ? {
        mode: "direct" as const,
        tokenUrl: "/api/uploads/drink-photo/blob-token",
        finalizeUrl: "/api/uploads/drink-photo/finalize",
        keyPrefix: drinkPhotoKeyPrefix(userId),
      }
    : { mode: "server" as const, uploadUrl: "/api/uploads/drink-photo" };
}
