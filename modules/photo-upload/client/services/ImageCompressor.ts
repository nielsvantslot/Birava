import type { CompressConfig } from "./CompressConfig";
import type { IImageCompressor } from "./IImageCompressor";

/** Re-encoding at original size and this quality is close to lossless — used purely to strip metadata, not to shrink. */
const STRIP_ONLY_QUALITY = 0.95;

/**
 * Resizes/re-encodes an image in the browser before it ever leaves the
 * device — phone camera photos routinely exceed serverless request body
 * limits (e.g. Vercel's ~4.5MB), and uploading a full-size photo over
 * cellular is slow regardless. Always outputs JPEG for consistent cross-
 * browser `canvas.toBlob` support (Safari's WebP encode support is patchy).
 */
export class ImageCompressor implements IImageCompressor {
  async compressForUpload(blob: Blob, fileName: string, config: CompressConfig): Promise<File> {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const scale = Math.min(1, config.maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    return this.renderToJpeg(bitmap, width, height, config.quality, fileName);
  }

  /**
   * Re-encodes at the image's original dimensions and near-lossless quality
   * — for files that don't need real shrinking but still must never leave
   * the device carrying EXIF metadata (which can include GPS coordinates).
   * A canvas round-trip strips EXIF as a side effect of decoding to raw
   * pixels; this method exists so that stripping doesn't have to come
   * bundled with a quality-lossy resize + lower-quality re-encode too.
   */
  async stripMetadataOnly(blob: Blob, fileName: string): Promise<File> {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    return this.renderToJpeg(bitmap, bitmap.width, bitmap.height, STRIP_ONLY_QUALITY, fileName);
  }

  private async renderToJpeg(
    bitmap: ImageBitmap,
    width: number,
    height: number,
    quality: number,
    fileName: string
  ): Promise<File> {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const outBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        quality
      );
    });

    const baseName = fileName.replace(/\.[^./\\]+$/, "") || "photo";
    return new File([outBlob], `${baseName}.jpg`, { type: "image/jpeg" });
  }
}
