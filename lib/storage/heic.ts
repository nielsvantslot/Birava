import convert from "heic-convert";

const HEIC_EXTENSIONS = [".heic", ".heif"];
const HEIC_MIME_TYPES = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];

function isHeic(file: File): boolean {
  const name = file.name.toLowerCase();
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext)) || HEIC_MIME_TYPES.includes(file.type);
}

/**
 * HEIC/HEIF (the default iPhone camera format) can't be rendered by an <img>
 * tag in Chrome/Firefox/Edge — only Safari decodes it natively. Convert to
 * JPEG at upload time so the photo displays for every viewer regardless of
 * which device took it or which browser they're on.
 */
export async function normalizeUploadedPhoto(file: File): Promise<File> {
  if (!isHeic(file)) return file;

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const outputBuffer = await convert({ buffer: inputBuffer, format: "JPEG", quality: 0.9 });

  const baseName = file.name.replace(/\.(heic|heif)$/i, "") || "photo";
  return new File([Uint8Array.from(outputBuffer)], `${baseName}.jpg`, { type: "image/jpeg" });
}
