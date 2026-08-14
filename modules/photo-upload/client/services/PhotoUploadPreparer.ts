import { HeicConverter } from "./HeicConverter";
import { ImageCompressor } from "./ImageCompressor";
import type { CompressConfig } from "./CompressConfig";
import type { IHeicConverter } from "./IHeicConverter";
import type { IImageCompressor } from "./IImageCompressor";
import type { PreparedPhoto } from "../Models";

const DEFAULT_SKIP_THRESHOLD_BYTES = 3 * 1024 * 1024;

/**
 * Thrown instead of falling back to the original file when `mustStripMetadata`
 * is true and the canvas re-encode that would have stripped EXIF (which can
 * carry GPS) fails — the caller required a stripped result and none could be
 * produced, so silently uploading the untouched original isn't a safe
 * fallback here. Callers should catch this and reject the photo (e.g. show an
 * error, don't proceed to upload) rather than let it propagate as an
 * unhandled rejection.
 */
export class PhotoMetadataStripFailedError extends Error {
  constructor() {
    super("Couldn't process this photo. Try a different one.");
  }
}

/**
 * The full client-side "user picked a file" step: HEIC → JPEG if needed,
 * then resize/compress (only when the file actually needs it), then a
 * preview URL. Falls back to the original file (uncompressed) if canvas/
 * createImageBitmap isn't available or the decode fails — the server-side
 * pipeline still validates/processes it regardless. Exception: when
 * `mustStripMetadata` is true, that fallback would upload the file's
 * untouched original bytes (possibly still carrying EXIF/GPS) straight to
 * durable storage, so a failure there throws PhotoMetadataStripFailedError
 * instead.
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
        // The original HEIC is untouched here and can itself carry EXIF/GPS.
        if (mustStripMetadata) throw new PhotoMetadataStripFailedError();
        return { file, previewUrl: null };
      }
      // heic-convert's decode/re-encode carries no EXIF over, so a fallback
      // to `decodable` here is already metadata-safe regardless of
      // mustStripMetadata.
      return PhotoUploadPreparer.encodeWithFallback(
        () => imageCompressor.compressForUpload(decodable, file.name, config),
        file,
        decodable,
        false
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
        file,
        true
      );
    }

    return PhotoUploadPreparer.encodeWithFallback(
      () => imageCompressor.compressForUpload(file, file.name, config),
      file,
      file,
      mustStripMetadata
    );
  }

  /**
   * Runs an encode step; on failure, falls back to the original file with a
   * preview built from `fallbackPreviewSource` — unless `unsafeIfFallback` is
   * true, in which case that fallback would still carry whatever metadata the
   * original had, so it throws PhotoMetadataStripFailedError instead of
   * silently using it.
   */
  private static async encodeWithFallback(
    encode: () => Promise<File>,
    fallbackFile: File,
    fallbackPreviewSource: Blob,
    unsafeIfFallback: boolean
  ): Promise<PreparedPhoto> {
    try {
      const encoded = await encode();
      return { file: encoded, previewUrl: URL.createObjectURL(encoded) };
    } catch {
      if (unsafeIfFallback) throw new PhotoMetadataStripFailedError();
      return { file: fallbackFile, previewUrl: URL.createObjectURL(fallbackPreviewSource) };
    }
  }
}
