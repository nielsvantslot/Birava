import type { CompressConfig } from "./CompressConfig";

/**
 * Client-side image resize/re-encode, injected into `PhotoUploadPreparer`
 * for the same reason `IHeicConverter` is: consistent DI discipline with the
 * server side, even with one canvas-based implementation today.
 */
export interface IImageCompressor {
  compressForUpload(blob: Blob, fileName: string, config: CompressConfig): Promise<File>;
  /** Re-encodes at original dimensions and near-lossless quality — strips metadata without a real resize. */
  stripMetadataOnly(blob: Blob, fileName: string): Promise<File>;
}
