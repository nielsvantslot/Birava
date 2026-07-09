import crypto from 'crypto';
import path from 'path';

import {
  del,
  get,
  put,
} from '@vercel/blob';

export async function saveBeerPhoto(userId: string, file: File) {
  const ext = path.extname(file.name) || ".jpg";
  const fileName = `entries-photos/${userId}/${crypto.randomUUID()}${ext.toLowerCase()}`;

  const blob = await put(fileName, file, {
    access: "private",
    addRandomSuffix: false,
  });

  return blob.url;
}

export async function removeBeerPhotoByUrl(photoUrl: string) {
  try {
    await del(photoUrl);
  } catch {
    // Keep delete idempotent if the file has already been removed.
  }
}

export async function readBeerPhoto(photoUrl: string) {
  const result = await get(photoUrl, { access: "private" });
  if (!result || !result.stream) return null;

  return { stream: result.stream, contentType: result.blob.contentType ?? "application/octet-stream" };
}
