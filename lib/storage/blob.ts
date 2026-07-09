import crypto from 'crypto';
import path from 'path';

import {
  del,
  put,
} from '@vercel/blob';

export async function saveBeerPhoto(userId: string, file: File) {
  const ext = path.extname(file.name) || ".jpg";
  const fileName = `entries-photos/${userId}/${crypto.randomUUID()}${ext.toLowerCase()}`;

  const blob = await put(fileName, file, {
    access: "public",
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
