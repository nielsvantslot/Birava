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
