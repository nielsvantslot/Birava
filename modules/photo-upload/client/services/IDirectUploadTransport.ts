/**
 * The browser-side half of a direct upload: PUT the file straight to
 * storage and return its URL. Injected into `PhotoUploader.upload` rather
 * than hardcoded, so swapping the server's `IDirectUploadCoordinator` (e.g.
 * for S3 presigned URLs) has a matching client-side swap instead of
 * requiring edits inside `PhotoUploader` itself.
 */
export interface IDirectUploadTransport {
  putDirect(pathname: string, file: File, tokenUrl: string): Promise<{ url: string }>;
}
