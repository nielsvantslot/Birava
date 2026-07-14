import { HeicFileDetector } from "../../HeicFileDetector";
import type { IHeicConverter } from "./IHeicConverter";

/**
 * Chrome/Firefox/Edge can't render HEIC (iPhone's default camera format) in
 * an `<img>` tag at all — convert to JPEG in the browser so there's always
 * something decodable to preview and to feed into `IImageCompressor`.
 */
export class HeicConverter implements IHeicConverter {
  isHeic(file: File): boolean {
    return HeicFileDetector.isHeic(file);
  }

  async toJpeg(file: File, quality = 0.9): Promise<Blob> {
    if (!this.isHeic(file)) return file;

    const convert = (await import("heic-convert/browser")).default;
    const buffer = new Uint8Array(await file.arrayBuffer());
    const jpeg = await convert({ buffer, format: "JPEG", quality });
    return new Blob([Uint8Array.from(jpeg)], { type: "image/jpeg" });
  }
}
