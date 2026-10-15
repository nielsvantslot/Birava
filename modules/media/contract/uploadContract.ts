import { z } from "zod";

/** `{ url }` bodies: deleting an upload, and the finalize step of a direct upload. */
export const uploadUrlInput = z.object({ url: z.string().min(1) });

/** Multipart upload: a single `file` part. */
export const uploadFileForm = z.object({ file: z.instanceof(File) });

/** The direct-upload token request is an opaque JSON object owned by the storage vendor's client. */
export const directUploadTokenInput = z.json();

/** `GET /api/photos/[entryId]` resize options: `size=thumb` or `w=<one of HERO_WIDTHS>`; anything else serves the full image. */
export const photoResizeQuery = z.object({
  size: z.string().optional(),
  w: z.string().optional(),
});
