import { PhotoUploadError } from "./Errors/PhotoUploadError";
import type { Authenticate } from "./Authenticate";
import type { ErrorResponseDto } from "./Dto/ErrorResponseDto";
import type { Json } from "./Models";
import type { IPhotoUploadService } from "./services/IPhotoUploadService";

/** Next.js Route Handler factories wrapping an `IPhotoUploadService` — one static method per route this module needs mounted. */
export class PhotoUploadRouteFactory {
  private static unauthenticated(): Response {
    return Response.json({ error: "Not authenticated" } satisfies ErrorResponseDto, { status: 401 });
  }

  /** Reads a string field (e.g. a delete/finalize request body's `url`) off a parsed JSON body, without trusting its shape beyond that one field. */
  private static readStringField(body: Json, key: string): string {
    if (typeof body !== "object" || body === null || Array.isArray(body)) return "";
    const value = body[key];
    return typeof value === "string" ? value : "";
  }

  /** POST multipart/form-data `file` → `UploadResultDto`. The plain, single-request upload path. */
  static createUploadRoute<Ctx>(service: IPhotoUploadService, authenticate: Authenticate<Ctx>) {
    return async (request: Request, context: Ctx): Promise<Response> => {
      const user = await authenticate(request, context);
      if (!user) return PhotoUploadRouteFactory.unauthenticated();

      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return Response.json({ error: "No file provided." } satisfies ErrorResponseDto, { status: 400 });
      }

      // The caller (e.g. a cancelled/replaced photo pick) may have already
      // disconnected by the time the (possibly large) body finished
      // buffering above — Next doesn't tie this handler's execution to the
      // request's lifetime on its own, so without this check the file still
      // gets processed and written, orphaned, with nothing the client could
      // ever reference to clean it up. This narrows that window but can't
      // close it entirely — a disconnect isn't always observable this early
      // (verified: a same-request abort on a fast local upload can still slip
      // past this single check and finish writing before the platform notices
      // the client is gone). Good enough to catch the common case; not a
      // guarantee.
      if (request.signal.aborted) {
        return Response.json({ error: "Upload cancelled." } satisfies ErrorResponseDto, { status: 499 });
      }

      try {
        const result = await service.processAndStore(file, user.id);
        return Response.json(result);
      } catch (error) {
        const message = error instanceof PhotoUploadError
          ? error.message
          : "Couldn't read that photo. Try a different file.";
        return Response.json({ error: message } satisfies ErrorResponseDto, { status: 400 });
      }
    };
  }

  /** POST `{ url }` → deletes a previously uploaded photo, scoped to the caller's own namespace. */
  static createDeleteRoute<Ctx>(service: IPhotoUploadService, authenticate: Authenticate<Ctx>) {
    return async (request: Request, context: Ctx): Promise<Response> => {
      const user = await authenticate(request, context);
      if (!user) return PhotoUploadRouteFactory.unauthenticated();

      const body: Json = await request.json().catch(() => null);
      const url = PhotoUploadRouteFactory.readStringField(body, "url");
      if (!url) return Response.json({ error: "Invalid request body." } satisfies ErrorResponseDto, { status: 400 });

      try {
        await service.remove(url, user.id);
        return Response.json({ success: true });
      } catch {
        return Response.json({ error: "Failed to delete photo." } satisfies ErrorResponseDto, { status: 400 });
      }
    };
  }

  /**
   * Step 1 of the direct-upload path: the browser POSTs here first (via a
   * `IDirectUploadTransport`) to get a scoped upload token before PUTting the
   * file straight to storage.
   */
  static createDirectUploadTokenRoute<Ctx>(service: IPhotoUploadService, authenticate: Authenticate<Ctx>) {
    return async (request: Request, context: Ctx): Promise<Response> => {
      const user = await authenticate(request, context);
      if (!user) return PhotoUploadRouteFactory.unauthenticated();

      try {
        // Annotated (not cast) the moment it leaves the untyped Fetch API
        // boundary — Request.json() itself returns Promise<any>.
        const requestBody: Json = await request.json();
        const result = await service.createDirectUploadToken({ requestBody, request, ownerId: user.id });
        return Response.json(result);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Upload failed." } satisfies ErrorResponseDto,
          { status: 400 }
        );
      }
    };
  }

  /** Step 2 of the direct-upload path: POST `{ url }` (the raw upload's URL) → `UploadResultDto`. */
  static createFinalizeRoute<Ctx>(service: IPhotoUploadService, authenticate: Authenticate<Ctx>) {
    return async (request: Request, context: Ctx): Promise<Response> => {
      const user = await authenticate(request, context);
      if (!user) return PhotoUploadRouteFactory.unauthenticated();

      const body: Json = await request.json().catch(() => null);
      const rawUrl = PhotoUploadRouteFactory.readStringField(body, "url");
      if (!rawUrl) return Response.json({ error: "Invalid upload." } satisfies ErrorResponseDto, { status: 400 });

      if (request.signal.aborted) {
        return Response.json({ error: "Upload cancelled." } satisfies ErrorResponseDto, { status: 499 });
      }

      try {
        const result = await service.finalizeDirectUpload(rawUrl, user.id);
        return Response.json(result);
      } catch (error) {
        const message = error instanceof PhotoUploadError ? error.message : "Failed to process photo.";
        return Response.json({ error: message } satisfies ErrorResponseDto, { status: 400 });
      }
    };
  }
}
