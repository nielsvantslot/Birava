import type { IDirectUploadTransport } from "./IDirectUploadTransport";

/**
 * Default `IDirectUploadTransport`, matching `VercelBlobDirectUploadCoordinator`
 * on the server. The `@vercel/blob/client` import is dynamic so a project
 * using a different transport isn't forced to have that package installed.
 */
export class VercelBlobDirectUploadTransport implements IDirectUploadTransport {
  async putDirect(pathname: string, file: File, tokenUrl: string): Promise<{ url: string }> {
    const { upload } = await import("@vercel/blob/client");
    const blob = await upload(pathname, file, { access: "private", handleUploadUrl: tokenUrl });
    return { url: blob.url };
  }
}
