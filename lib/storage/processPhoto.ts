import sharp from "sharp";

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 80;
const LQIP_WIDTH = 16;
const LQIP_QUALITY = 40;

export class InvalidPhotoError extends Error {}

export type ProcessedPhoto = {
  file: File;
  /** Tiny base64 data URI for next/image's placeholder="blur". */
  lqip: string;
};

async function encode(inputBuffer: Buffer, fileName: string): Promise<ProcessedPhoto> {
  let outputBuffer: Buffer;
  let lqipBuffer: Buffer;
  try {
    const rotated = sharp(inputBuffer).rotate();
    [outputBuffer, lqipBuffer] = await Promise.all([
      rotated
        .clone()
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer(),
      rotated
        .clone()
        .resize({ width: LQIP_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: LQIP_QUALITY })
        .toBuffer(),
    ]);
  } catch {
    throw new InvalidPhotoError("Couldn't read that photo. Try a different file.");
  }

  return {
    file: new File([Uint8Array.from(outputBuffer)], fileName, { type: "image/webp" }),
    lqip: `data:image/jpeg;base64,${lqipBuffer.toString("base64")}`,
  };
}

/**
 * Runs after HEIC normalization. Auto-rotates from EXIF orientation, caps
 * dimensions, strips metadata (EXIF can carry GPS coordinates), and
 * re-encodes as WebP so stored/served bytes are a fraction of a raw phone
 * photo. Also derives a tiny blurred placeholder from the same decode.
 */
export async function processUploadedPhoto(file: File): Promise<ProcessedPhoto> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new InvalidPhotoError("Photo is too large. Please use a file under 20MB.");
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const baseName = file.name.replace(/\.[^./\\]+$/, "") || "photo";
  return encode(inputBuffer, `${baseName}.webp`);
}

/**
 * Same pipeline as processUploadedPhoto, for scripts/backfill-photo-derivatives.ts
 * to reprocess a photo that's already in storage — no HEIC/size concerns
 * since it was already accepted once through the normal upload path.
 */
export async function reencodeStoredPhoto(inputBuffer: Buffer): Promise<ProcessedPhoto> {
  return encode(inputBuffer, "photo.webp");
}
