import { PhotoUploadError } from "./Errors/PhotoUploadError";
import type { Authenticate } from "./Authenticate";
import type { DeletePhotoRequestDto } from "./Dto/DeletePhotoRequestDto";
import type { ErrorResponseDto } from "./Dto/ErrorResponseDto";
import type { FinalizeUploadRequestDto } from "./Dto/FinalizeUploadRequestDto";
import type { IPhotoUploadService } from "./services/IPhotoUploadService";

/** Next.js Route Handler factories wrapping an `IPhotoUploadService` — one static method per route this module needs mounted. */
export class PhotoUploadRouteFactory {
  private static unauthenticated(): Response {
    return Response.json({ error: "Not authenticated" } satisfies ErrorResponseDto, { status: 401 });
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

  /** POST a `DeletePhotoRequestDto` → deletes a previously uploaded photo, scoped to the caller's own namespace. */
  static createDeleteRoute<Ctx>(service: IPhotoUploadService, authenticate: Authenticate<Ctx>) {
    return async (request: Request, context: Ctx): Promise<Response> => {
      const user = await authenticate(request, context);
      if (!user) return PhotoUploadRouteFactory.unauthenticated();

      const body = (await request.json().catch(() => null)) as Partial<DeletePhotoRequestDto> | null;
      if (!body) return Response.json({ error: "Invalid request body." } satisfies ErrorResponseDto, { status: 400 });

      const url = typeof body.url === "string" ? body.url : "";
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
        const requestBody = await request.json();
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

  /** Step 2 of the direct-upload path: POST a `FinalizeUploadRequestDto` (the raw upload's URL) → `UploadResultDto`. */
  static createFinalizeRoute<Ctx>(service: IPhotoUploadService, authenticate: Authenticate<Ctx>) {
    return async (request: Request, context: Ctx): Promise<Response> => {
      const user = await authenticate(request, context);
      if (!user) return PhotoUploadRouteFactory.unauthenticated();

      const body = (await request.json().catch(() => null)) as Partial<FinalizeUploadRequestDto> | null;
      const rawUrl = typeof body?.url === "string" ? body.url : "";
      if (!rawUrl) return Response.json({ error: "Invalid upload." } satisfies ErrorResponseDto, { status: 400 });

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
