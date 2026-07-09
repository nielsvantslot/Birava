import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const uploadsRoot = path.join(process.cwd(), "public", "uploads", "entries-photos");

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function saveBeerPhoto(userId: string, file: File) {
  const ext = path.extname(file.name) || ".jpg";
  const fileName = `${crypto.randomUUID()}${ext.toLowerCase()}`;
  const userDir = path.join(uploadsRoot, userId);
  await ensureDir(userDir);

  const buffer = Buffer.from(await file.arrayBuffer());
  const absolutePath = path.join(userDir, fileName);
  await fs.writeFile(absolutePath, buffer);

  return `/uploads/entries-photos/${userId}/${fileName}`;
}

export async function removeBeerPhotoByUrl(photoUrl: string) {
  try {
    const url = new URL(photoUrl, "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith("/uploads/entries-photos/")) return;

    const filePath = path.join(process.cwd(), "public", pathname.replace(/^\//, ""));
    await fs.unlink(filePath);
  } catch {
    // Keep delete idempotent if the file has already been removed.
  }
}
