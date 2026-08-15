import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { Json } from "../Models";
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

  async handleTokenRequest(input: HandleTokenRequestInput): Promise<Json> {
    const { requestBody, request, validatePathname, maxUploadBytes, allowedContentTypes } = input;
    // Without an explicit callbackUrl, @vercel/blob computes one from
    // Vercel's own System Environment Variables (VERCEL_URL et al.), which
    // always point at the deployment's own *.vercel.app URL — never a
    // custom domain alias. This app serves entirely on custom domains
    // (birava.nl, staging.birava.nl), so that auto-computed URL never
    // matches where the browser's direct-upload request actually came
    // from. Confirmed live: every client-side direct upload on staging hung
    // for the full 15s timeout (PhotoUploader.ts's DIRECT_UPLOAD_TIMEOUT_MS)
    // before falling back to the server-mediated route, consistent with
    // Vercel's own documented custom-domain gotcha for this exact SDK
    // method. request.url reflects the real Host header Next.js received,
    // so deriving callbackUrl from it (rather than trusting the SDK's
    // built-in default) keeps this correct regardless of which domain the
    // request came in on.
    const callbackUrl = new URL(request.url).origin + new URL(request.url).pathname;
    // requestBody arrives as the interface's honest `Json` — its real shape
    // is Vercel's own GenerateClientTokenEvent | UploadCompletedEvent wire
    // protocol (@vercel/blob/client's HandleUploadBody), which this class
    // (unlike the provider-agnostic interface it implements) is allowed to
    // know about. handleUpload validates/verifies it internally (including
    // upload-completed's signature check) and throws on a malformed body —
    // hand-rolling that same validation here would just duplicate Vercel's
    // private wire format with no real safety gain, and drift the moment
    // their SDK's shape changes.
    return handleUpload({
      body: requestBody as unknown as HandleUploadBody,
      request,
      token: this.config.token,
      onBeforeGenerateToken: async (pathname) => {
        await validatePathname(pathname);
        return {
          allowedContentTypes,
          maximumSizeInBytes: maxUploadBytes,
          addRandomSuffix: false,
          callbackUrl,
        };
      },
    });
  }
}
