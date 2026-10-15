import { PhotoUploadError } from "./Errors/PhotoUploadError";
import { PhotoUploadRouteError } from "./Errors/PhotoUploadRouteError";
import type { UploadResultDto } from "./Dto/UploadResultDto";
import type { Json } from "./Models";
import type { IPhotoUploadService } from "./services/IPhotoUploadService";

/**
 * What each upload route does once the host has authenticated the caller and
 * parsed the request: one static method per route this module needs mounted.
 * The host owns authentication, body parsing and the error response shape;
 * these methods own the upload behaviour and throw `PhotoUploadRouteError`
 * for an expected failure.
 */
export class PhotoUploadRouteHandlers {
  /** The plain, single-request upload path: a multipart `file`. */
  static async upload(
    service: IPhotoUploadService,
    input: { file: File; request: Request; ownerId: string }
  ): Promise<UploadResultDto> {
    // The caller (e.g. a cancelled/replaced photo pick) may have already
    // disconnected by the time the (possibly large) body finished
    // buffering — Next doesn't tie this handler's execution to the
    // request's lifetime on its own, so without this check the file still
    // gets processed and written, orphaned, with nothing the client could
    // ever reference to clean it up. This narrows that window but can't
    // close it entirely — a disconnect isn't always observable this early
    // (verified: a same-request abort on a fast local upload can still slip
    // past this single check and finish writing before the platform notices
    // the client is gone). Good enough to catch the common case; not a
    // guarantee.
    if (input.request.signal.aborted) throw new PhotoUploadRouteError(499, "Upload cancelled.");

    try {
      return await service.processAndStore(input.file, input.ownerId);
    } catch (error) {
      const message = error instanceof PhotoUploadError
        ? error.message
        : "Couldn't read that photo. Try a different file.";
      throw new PhotoUploadRouteError(400, message);
    }
  }

  /** Deletes a previously uploaded photo, scoped to the caller's own namespace. */
  static async remove(
    service: IPhotoUploadService,
    input: { url: string; ownerId: string }
  ): Promise<{ success: true }> {
    try {
      await service.remove(input.url, input.ownerId);
      return { success: true };
    } catch {
      throw new PhotoUploadRouteError(400, "Failed to delete photo.");
    }
  }

  /**
   * Step 1 of the direct-upload path: the browser POSTs here first (via a
   * `IDirectUploadTransport`) to get a scoped upload token before PUTting the
   * file straight to storage.
   */
  static async createDirectUploadToken(
    service: IPhotoUploadService,
    input: { requestBody: Json; request: Request; ownerId: string }
  ): Promise<Json> {
    try {
      return await service.createDirectUploadToken(input);
    } catch (error) {
      throw new PhotoUploadRouteError(400, error instanceof Error ? error.message : "Upload failed.");
    }
  }

  /** Step 2 of the direct-upload path: the raw upload's URL in, the processed photo out. */
  static async finalize(
    service: IPhotoUploadService,
    input: { url: string; request: Request; ownerId: string }
  ): Promise<UploadResultDto> {
    if (input.request.signal.aborted) throw new PhotoUploadRouteError(499, "Upload cancelled.");

    try {
      return await service.finalizeDirectUpload(input.url, input.ownerId);
    } catch (error) {
      throw new PhotoUploadRouteError(400, error instanceof PhotoUploadError ? error.message : "Failed to process photo.");
    }
  }
}
