/** Isomorphic — pure string checks, safe on both the server and in the browser. */
export class FileNameUtil {
  /** "photo.HEIC" -> "photo" (falls back to "photo" for a name with no usable base, e.g. ".heic"). */
  static stripExtension(fileName: string): string {
    return fileName.replace(/\.[^./\\]+$/, "") || "photo";
  }
}
