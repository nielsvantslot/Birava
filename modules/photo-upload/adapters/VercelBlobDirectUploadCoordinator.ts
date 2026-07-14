import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { HandleTokenRequestInput, IDirectUploadCoordinator } from "./IDirectUploadCoordinator";
import type { VercelBlobDirectUploadCoordinatorConfig } from "./VercelBlobDirectUploadCoordinatorConfig";

/**
 * Vercel Blob's direct-client-upload capability, as its own collaborator —
 * separate from `VercelBlobStorageAdapter` so a service can be composed with
 * Blob storage but no direct-upload path, or in principle direct-upload from
 * one provider backed by storage from another. This is how the pipeline
 * bypasses the ~4.5MB request body limit on serverless functions: the
 * browser PUTs bytes straight to Blob storage, and only a URL (not the
 * file) ever touches a function's request body.
 *
 * No `access` option here (unlike `VercelBlobStorageAdapter`) — access mode
 * is chosen by the browser's own `upload()` call, not by the token issuer.
 */
export class VercelBlobDirectUploadCoordinator implements IDirectUploadCoordinator {
  constructor(private readonly config: VercelBlobDirectUploadCoordinatorConfig = {}) {}

  async handleTokenRequest(input: HandleTokenRequestInput): Promise<unknown> {
    const { requestBody, request, validatePathname, maxUploadBytes, allowedContentTypes } = input;
    return handleUpload({
      body: requestBody as HandleUploadBody,
      request,
      token: this.config.token,
      onBeforeGenerateToken: async (pathname) => {
        await validatePathname(pathname);
        return {
          allowedContentTypes,
          maximumSizeInBytes: maxUploadBytes,
          addRandomSuffix: false,
        };
      },
    });
  }
}
