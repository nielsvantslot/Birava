/**
 * Uploads an already-dumped, already-GPG-encrypted production backup to
 * Vercel Blob and prunes anything outside lib/backupRetention.ts's window.
 * Invoked by .github/workflows/db-backup.yml, which does the pg_dump +
 * encrypt in shell steps beforehand (a `docker run postgres:18-alpine`,
 * matching Neon's actual server version, gives a version-matched pg_dump
 * far more simply than this script trying to shell out to a system binary
 * of unknown version) — this script never sees plaintext.
 *
 * Reads BLOB_READ_WRITE_TOKEN from the environment, same as every other
 * @vercel/blob call in this repo (see VercelBlobStorageAdapterConfig).
 */
import { put, del } from "@vercel/blob";
import { readFileSync } from "node:fs";
import { partitionBackupsForRetention } from "../lib/backupRetention";
import { BACKUP_PREFIX, listBackups } from "../lib/backupBlobs";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error("usage: tsx scripts/backup-database.ts <path-to-encrypted-dump>");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const pathname = `${BACKUP_PREFIX}${timestamp}.dump.gpg`;

  const file = readFileSync(filePath);
  await put(pathname, file, { access: "private", addRandomSuffix: false });
  console.log(`Uploaded ${pathname} (${file.byteLength} bytes)`);

  const blobs = await listBackups();
  const { expire } = partitionBackupsForRetention(blobs, new Date());

  for (const stale of expire) {
    const blob = blobs.find((b) => b.pathname === stale.pathname);
    if (!blob) continue;
    await del(blob.url);
    console.log(`Pruned ${stale.pathname} (uploaded ${stale.uploadedAt.toISOString()})`);
  }

  console.log(`Retention: kept ${blobs.length - expire.length}, pruned ${expire.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
