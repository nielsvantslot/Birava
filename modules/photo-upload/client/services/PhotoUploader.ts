import { VercelBlobDirectUploadTransport } from "./VercelBlobDirectUploadTransport";
import type { DirectUploadEndpoints, ServerUploadEndpoints } from "../Models";
import type { PhotoUploadResultDto } from "../Dto/PhotoUploadResultDto";
import type { ErrorResponseDto } from "../../Dto/ErrorResponseDto";
import type { UploadResultDto } from "../../Dto/UploadResultDto";

type UploadResponseBody = Partial<UploadResultDto> & Partial<ErrorResponseDto>;

export class PhotoUploader {
  static async upload(
    file: File,
    endpoints: DirectUploadEndpoints | ServerUploadEndpoints,
    signal?: AbortSignal
  ): Promise<PhotoUploadResultDto> {
    return endpoints.mode === "direct"
      ? PhotoUploader.uploadDirect(file, endpoints, signal)
      : PhotoUploader.uploadViaServer(file, endpoints, signal);
  }

  /**
   * Uploads straight from the browser to storage via the injected `transport`
   * (per https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions),
   * then asks the server to fetch it back and run it through the processing
   * pipeline. Use wherever the service was configured with a `directUpload`
   * coordinator (e.g. production/staging with the Vercel Blob adapter).
   */
  private static async uploadDirect(
    file: File,
    endpoints: DirectUploadEndpoints,
    signal?: AbortSignal
  ): Promise<PhotoUploadResultDto> {
    const transport = endpoints.transport ?? new VercelBlobDirectUploadTransport();
    try {
      // The finalize step reconstructs a File from the raw bytes later, with
      // only this pathname's extension to go on for filename-based HEIC
      // detection — matching the real extension here (not a hardcoded .jpg)
      // keeps that detection working when a HEIC file skips client conversion.
      const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1] ?? "jpg";
      const pathname = `${endpoints.keyPrefix}/${crypto.randomUUID()}.${ext}`;
      const { url: rawUrl } = await transport.putDirect({
        pathname,
        file,
        tokenUrl: endpoints.tokenUrl,
        signal,
        access: endpoints.access,
      });

      const res = await fetch(endpoints.finalizeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl }),
        signal,
      });
      const result = await PhotoUploader.parseJson(res);
      if (!res.ok || !result?.url) return { error: result?.error ?? "Failed to process photo." };
      return { url: result.url, lqip: result.lqip ?? null };
    } catch {
      return { error: "Couldn't upload photo — try a smaller photo or check your connection." };
    }
  }

  /** Uploads through the server in a single multipart request. Use where direct uploads aren't available (e.g. local dev disk storage). */
  private static async uploadViaServer(
    file: File,
    endpoints: ServerUploadEndpoints,
    signal?: AbortSignal
  ): Promise<PhotoUploadResultDto> {
    const formData = new FormData();
    formData.append("file", file);

    let res: Response;
    try {
      res = await fetch(endpoints.uploadUrl, { method: "POST", body: formData, signal });
    } catch {
      return { error: "Couldn't upload photo — check your connection and try again." };
    }
    // A dropped/reset connection (e.g. the platform rejecting an oversized
    // payload) surfaces as a thrown fetch above rather than a response, but a
    // completed rejection commonly comes back as a plain 413 too.
    if (res.status === 413) return { error: "Photo is too large. Please use a smaller photo." };

    const result = await PhotoUploader.parseJson(res);
    if (!res.ok || !result?.url) return { error: result?.error ?? "Failed to upload photo." };
    return { url: result.url, lqip: result.lqip ?? null };
  }

  private static async parseJson(res: Response): Promise<UploadResponseBody | null> {
    return (await res.json().catch(() => null)) as UploadResponseBody | null;
  }
}
