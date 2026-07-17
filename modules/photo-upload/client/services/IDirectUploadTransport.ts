export interface DirectUploadRequest {
  readonly pathname: string;
  readonly file: File;
  readonly tokenUrl: string;
  readonly signal?: AbortSignal;
  /** Must match the owning service's storage access mode — the finalize step reads this raw upload back with that same mode. @default "private" */
  readonly access?: "public" | "private";
}

/**
 * The browser-side half of a direct upload: PUT the file straight to
 * storage and return its URL. Injected into `PhotoUploader.upload` rather
 * than hardcoded, so swapping the server's `IDirectUploadCoordinator` (e.g.
 * for S3 presigned URLs) has a matching client-side swap instead of
 * requiring edits inside `PhotoUploader` itself.
 */
export interface IDirectUploadTransport {
  putDirect(request: DirectUploadRequest): Promise<{ url: string }>;
}
