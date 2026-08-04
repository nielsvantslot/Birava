/**
 * A file/blob abstraction services can read bytes from, regardless of
 * runtime. `stream` is always a `ReadableStream` — adapters backed by an
 * already-in-memory buffer (e.g. disk) wrap it rather than leaking a
 * Buffer-or-stream union that every caller would otherwise have to branch on.
 */
export type StoredFile = {
  readonly stream: ReadableStream<Uint8Array>;
  readonly contentType: string;
};

/** Internal result of the image-processing step — not itself serialized; see `Dto/UploadResultDto.ts` for the wire shape. */
export type ProcessedImage = {
  readonly file: File;
  readonly lqip: string | null;
};

/**
 * Arbitrary parsed JSON. Used at the direct-upload token boundary
 * (`IDirectUploadCoordinator.handleTokenRequest`) for a request/response body
 * whose real shape is provider-specific (Vercel Blob's `HandleUploadBody`,
 * or another provider's own protocol entirely) and deliberately not known to
 * this module — see `adapters/IDirectUploadCoordinator.ts`. `unknown` would
 * say less than this actually is: the value always comes from parsed JSON,
 * never a function, symbol, or class instance, so this says exactly that
 * without lying about knowing the provider-specific shape on top of it.
 */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];
