import type { DirectUploadRequest, IDirectUploadTransport } from "./IDirectUploadTransport";

/**
 * Default `IDirectUploadTransport`, matching `VercelBlobDirectUploadCoordinator`
 * on the server. The `@vercel/blob/client` import is dynamic so a project
 * using a different transport isn't forced to have that package installed.
 */
export class VercelBlobDirectUploadTransport implements IDirectUploadTransport {
  async putDirect({ pathname, file, tokenUrl, signal, access = "private" }: DirectUploadRequest): Promise<{ url: string }> {
    const { upload } = await import("@vercel/blob/client");
    const blob = await upload(pathname, file, { access, handleUploadUrl: tokenUrl, abortSignal: signal });
    return { url: blob.url };
  }
}
