import type { ProcessedImage } from "../Models";

/**
 * The image-processing strategy, injected rather than hardcoded — see
 * `services/SharpImageProcessor.ts` for the default implementation. Swap in
 * a different one for a different image library, a no-HEIC-support variant,
 * or a no-op passthrough for tests.
 */
export interface IImageProcessor {
  /** Full ingest path: format-normalize (e.g. HEIC→JPEG), validate size, resize/strip/re-encode. */
  processUpload(file: File): Promise<ProcessedImage>;
  /** Re-encode only — for reprocessing bytes that were already accepted once (e.g. a migration/backfill). */
  reprocessBuffer(buffer: Buffer): Promise<ProcessedImage>;
}
