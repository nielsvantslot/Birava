import { HeicConverter } from "./HeicConverter";
import { ImageCompressor } from "./ImageCompressor";
import type { CompressConfig } from "./CompressConfig";
import type { IHeicConverter } from "./IHeicConverter";
import type { IImageCompressor } from "./IImageCompressor";
import type { PreparedPhoto } from "../Models";

const DEFAULT_SKIP_THRESHOLD_BYTES = 3 * 1024 * 1024;

/**
 * The full client-side "user picked a file" step: HEIC → JPEG if needed,
 * then resize/compress (only when the file actually needs it), then a
 * preview URL. Falls back to the original file (uncompressed) if canvas/
 * createImageBitmap isn't available or the decode fails — the server-side
 * pipeline still validates/processes it regardless.
 */
export class PhotoUploadPreparer {
  /**
   * @param mustStripMetadata Pass `true` when the result may be written to
   *   durable storage before the server ever processes it — the browser-
   *   direct upload path stores whatever bytes it's given as-is, so EXIF
   *   (which can carry GPS) must already be gone before that PUT, even for
   *   files too small to otherwise need compressing. Pass `false` for the
   *   plain server-upload path, where the raw bytes only ever exist inside
   *   a request the server processes in-memory and never persists un-stripped.
   * @param heicConverter @param imageCompressor Injected so a different
   *   decode/compress strategy can be swapped in without touching this
   *   class — defaults to the browser-native canvas/heic-convert pair.
   */
  static async prepare(
    file: File,
    config: CompressConfig,
    mustStripMetadata: boolean,
    heicConverter: IHeicConverter = new HeicConverter(),
    imageCompressor: IImageCompressor = new ImageCompressor()
  ): Promise<PreparedPhoto> {
    if (heicConverter.isHeic(file)) {
      let decodable: Blob;
      try {
        decodable = await heicConverter.toJpeg(file);
      } catch {
        return { file, previewUrl: null };
      }
      // heic-convert's decode/re-encode carries no EXIF over, so the metadata
      // concern is already moot here — always run the normal compress path.
      return PhotoUploadPreparer.encodeWithFallback(
        () => imageCompressor.compressForUpload(decodable, file.name, config),
        file,
        decodable
      );
    }

    const threshold = config.skipIfSmallerThanBytes ?? DEFAULT_SKIP_THRESHOLD_BYTES;
    if (file.size <= threshold) {
      if (!mustStripMetadata) {
        return { file, previewUrl: URL.createObjectURL(file) };
      }
      return PhotoUploadPreparer.encodeWithFallback(
        () => imageCompressor.stripMetadataOnly(file, file.name),
        file,
        file
      );
    }

    return PhotoUploadPreparer.encodeWithFallback(
      () => imageCompressor.compressForUpload(file, file.name, config),
      file,
      file
    );
  }

  /** Runs an encode step; on failure, falls back to the original file with a preview built from `fallbackPreviewSource`. */
  private static async encodeWithFallback(
    encode: () => Promise<File>,
    fallbackFile: File,
    fallbackPreviewSource: Blob
  ): Promise<PreparedPhoto> {
    try {
      const encoded = await encode();
      return { file: encoded, previewUrl: URL.createObjectURL(encoded) };
    } catch {
      return { file: fallbackFile, previewUrl: URL.createObjectURL(fallbackPreviewSource) };
    }
  }
}
