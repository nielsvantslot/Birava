/**
 * Downloads the most recent backup uploaded by scripts/backup-database.ts,
 * still GPG-encrypted, for .github/workflows/restore-drill.yml to decrypt
 * and pg_restore into a scratch Neon branch.
 */
import { downloadBackup, getLatestBackup } from "../lib/backupBlobs";

async function main() {
  const outPath = process.argv[2];
  if (!outPath) {
    throw new Error("usage: tsx scripts/download-latest-backup.ts <output-path>");
  }

  const latest = await getLatestBackup();
  console.log(`Downloading ${latest.pathname} (uploaded ${latest.uploadedAt.toISOString()})`);
  await downloadBackup(latest, outPath);
  console.log(`Wrote backup to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
