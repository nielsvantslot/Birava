import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const uploadsRoot = path.join(process.cwd(), "public", "uploads", "entries-photos");

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function saveDrinkPhoto(userId: string, file: File) {
  const ext = path.extname(file.name) || ".jpg";
  const fileName = `${crypto.randomUUID()}${ext.toLowerCase()}`;
  const userDir = path.join(uploadsRoot, userId);
  await ensureDir(userDir);

  const buffer = Buffer.from(await file.arrayBuffer());
  const absolutePath = path.join(userDir, fileName);
  await fs.writeFile(absolutePath, buffer);

  return `/uploads/entries-photos/${userId}/${fileName}`;
}

export async function removeDrinkPhotoByUrl(photoUrl: string) {
  try {
    const filePath = resolveLocalPath(photoUrl);
    if (!filePath) return;
    await fs.unlink(filePath);
  } catch {
    // Keep delete idempotent if the file has already been removed.
  }
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function resolveLocalPath(photoUrl: string) {
  const url = new URL(photoUrl, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  if (!pathname.startsWith("/uploads/entries-photos/")) return null;

  return path.join(process.cwd(), "public", pathname.replace(/^\//, ""));
}

export async function readDrinkPhoto(photoUrl: string) {
  const filePath = resolveLocalPath(photoUrl);
  if (!filePath) return null;

  try {
    const buffer = await fs.readFile(filePath);
    const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
    return { stream: buffer, contentType };
  } catch {
    return null;
  }
}
