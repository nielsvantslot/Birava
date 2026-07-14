import sharp from "sharp";
import convert from "heic-convert";
import { HeicFileDetector } from "../HeicFileDetector";
import { PhotoTooLargeError } from "../Errors/PhotoTooLargeError";
import { UnreadablePhotoError } from "../Errors/UnreadablePhotoError";
import type { ProcessedImage } from "../Models";
import type { IImageProcessor } from "./IImageProcessor";
import type { SharpImageProcessorConfig } from "./SharpImageProcessorConfig";

/**
 * The default `IImageProcessor`: sharp for resize/strip/re-encode,
 * heic-convert for HEIC/HEIF normalization. Swap this out — implement
 * `IImageProcessor` directly — for a different image library, a
 * no-HEIC-support variant, or a no-op passthrough for tests.
 */
export class SharpImageProcessor implements IImageProcessor {
  constructor(private readonly config: SharpImageProcessorConfig) {}

  /** Format-normalizes (HEIC→JPEG), validates size, then resizes/strips/re-encodes. */
  async processUpload(file: File): Promise<ProcessedImage> {
    const normalized = await this.normalizeHeic(file);
    if (normalized.size > this.config.maxInputBytes) {
      const maxMb = Math.round(this.config.maxInputBytes / (1024 * 1024));
      throw new PhotoTooLargeError(`Photo is too large. Please use a file under ${maxMb}MB.`);
    }

    const inputBuffer = Buffer.from(await normalized.arrayBuffer());
    return this.encode(inputBuffer, normalized.name);
  }

  /** Re-encodes bytes that were already accepted once — no HEIC-normalize or size validation. */
  async reprocessBuffer(buffer: Buffer): Promise<ProcessedImage> {
    return this.encode(buffer, "photo");
  }

  /**
   * HEIC/HEIF (the default iPhone camera format) isn't decodable by sharp.
   * Convert to JPEG first so everything downstream only ever deals with one
   * input format.
   */
  private async normalizeHeic(file: File, quality = 0.9): Promise<File> {
    if (!HeicFileDetector.isHeic(file)) return file;

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const outputBuffer = await convert({ buffer: inputBuffer, format: "JPEG", quality });

    const baseName = file.name.replace(/\.(heic|heif)$/i, "") || "photo";
    return new File([Uint8Array.from(outputBuffer)], `${baseName}.jpg`, { type: "image/jpeg" });
  }

  /**
   * Auto-rotates from EXIF orientation, caps dimensions, strips metadata
   * (EXIF can carry GPS coordinates), and re-encodes to a single predictable
   * format. Also derives a tiny blurred placeholder from the same decode
   * when `lqip` is configured.
   */
  private async encode(inputBuffer: Buffer, fileName: string): Promise<ProcessedImage> {
    const format = this.config.format ?? "webp";
    const { ext, mime } = this.extensionAndMimeFor(format);

    let outputBuffer: Buffer;
    let lqipBuffer: Buffer | null = null;
    try {
      const rotated = sharp(inputBuffer).rotate();
      const resized = rotated
        .clone()
        .resize({ width: this.config.maxDimension, height: this.config.maxDimension, fit: "inside", withoutEnlargement: true });

      const encoded = format === "webp"
        ? resized.webp({ quality: this.config.quality })
        : resized.jpeg({ quality: this.config.quality });

      if (this.config.lqip) {
        const { lqip } = this.config;
        [outputBuffer, lqipBuffer] = await Promise.all([
          encoded.toBuffer(),
          rotated
            .clone()
            .resize({ width: lqip.width, withoutEnlargement: true })
            .jpeg({ quality: lqip.quality })
            .toBuffer(),
        ]);
      } else {
        outputBuffer = await encoded.toBuffer();
      }
    } catch {
      throw new UnreadablePhotoError("Couldn't read that photo. Try a different file.");
    }

    const baseName = fileName.replace(/\.[^./\\]+$/, "") || "photo";
    return {
      file: new File([Uint8Array.from(outputBuffer)], `${baseName}.${ext}`, { type: mime }),
      lqip: lqipBuffer ? `data:image/jpeg;base64,${lqipBuffer.toString("base64")}` : null,
    };
  }

  private extensionAndMimeFor(format: "webp" | "jpeg"): { ext: string; mime: string } {
    return format === "webp" ? { ext: "webp", mime: "image/webp" } : { ext: "jpg", mime: "image/jpeg" };
  }
}
