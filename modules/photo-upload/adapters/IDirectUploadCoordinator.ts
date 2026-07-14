/** Input to `IDirectUploadCoordinator.handleTokenRequest` — named once here so the interface and its implementations can't drift apart. */
export interface HandleTokenRequestInput {
  readonly requestBody: unknown;
  readonly request: Request;
  readonly maxUploadBytes: number;
  readonly allowedContentTypes: string[];
  readonly validatePathname: (pathname: string) => void | Promise<void>;
}

/**
 * A standalone, optional collaborator for providers that support
 * browser-direct uploads (bypassing a serverless function's request body
 * limit). Deliberately independent of `IStorageAdapter` — not every storage
 * backend has a direct-upload story (disk doesn't), and providers that do
 * (Vercel Blob, S3 presigned URLs, ...) implement it very differently.
 * `PhotoUploadService` takes this as its own injected, optional dependency
 * rather than checking whether a given `IStorageAdapter` happens to also
 * have this shape.
 *
 * The request/response shape is provider-specific and passed through
 * opaquely — `PhotoUploadRouteFactory` (`PhotoUploadRouteFactory.ts`) just forwards it.
 */
export interface IDirectUploadCoordinator {
  handleTokenRequest(input: HandleTokenRequestInput): Promise<unknown>;
}
