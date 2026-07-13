const HEIC_EXTENSIONS = [".heic", ".heif"];

/** Isomorphic — pure string checks, safe on both the server and in the browser. */
export class HeicFileDetector {
  /** Exposed so consumers (e.g. the direct-upload content-type allowlist) can stay in sync without hand-duplicating this list. */
  static readonly HEIC_MIME_TYPES: readonly string[] = [
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
  ];

  static isHeic(file: { name: string; type: string }): boolean {
    const name = file.name.toLowerCase();
    return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext)) || HeicFileDetector.HEIC_MIME_TYPES.includes(file.type);
  }
}
