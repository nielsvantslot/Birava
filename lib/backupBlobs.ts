import { get, list } from "@vercel/blob";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";

/** Where scripts/backup-database.ts uploads to and everything else reads from. */
export const BACKUP_PREFIX = "db-backups/";

export type BackupBlob = {
  pathname: string;
  url: string;
  uploadedAt: Date;
  size: number;
};

export async function listBackups(): Promise<BackupBlob[]> {
  const { blobs } = await list({ prefix: BACKUP_PREFIX });
  return blobs
    .map((b) => ({ pathname: b.pathname, url: b.url, uploadedAt: b.uploadedAt, size: b.size }))
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
}

export async function getLatestBackup(): Promise<BackupBlob> {
  const backups = await listBackups();
  if (backups.length === 0) {
    throw new Error(`No backups found under ${BACKUP_PREFIX}.`);
  }
  return backups[0];
}

export async function downloadBackup(blob: BackupBlob, destPath: string): Promise<void> {
  const result = await get(blob.url, { access: "private" });
  if (!result?.stream) {
    throw new Error(`Could not read ${blob.pathname} from Blob.`);
  }
  await pipeline(
    Readable.fromWeb(result.stream as unknown as NodeWebReadableStream<Uint8Array>),
    createWriteStream(destPath)
  );
}
