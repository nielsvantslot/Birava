/**
 * Emergency restore CLI — the tool you actually run the day production is
 * gone or corrupted, instead of hand-typing the multi-step runbook under
 * pressure. Lists available backups, confirms exactly what's about to
 * happen (which backup, which target), then does
 * download -> decrypt -> pg_restore -> verify -> cleanup as one command.
 *
 * Requires locally: gpg (any modern version — no version-compatibility
 * concern like pg_restore has) and Docker (for a version-matched
 * postgres:18-alpine pg_restore, matching Neon's actual server version —
 * same reasoning as db-backup.yml/restore-drill.yml).
 *
 * Usage:
 *   npx tsx scripts/restore-backup.ts --list
 *   npx tsx scripts/restore-backup.ts --target "postgresql://..." [--backup <pathname>] [--yes]
 *
 * Env (in place of flags, so secrets don't sit in shell history):
 *   RESTORE_TARGET_DATABASE_URL, BACKUP_ENCRYPTION_KEY, BLOB_READ_WRITE_TOKEN
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import { downloadBackup, listBackups, type BackupBlob } from "../lib/backupBlobs";
import { verifyRestoredDatabase } from "../lib/backupVerification";

type Args = {
  list: boolean;
  target: string | null;
  backup: string | null;
  yes: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { list: false, target: process.env.RESTORE_TARGET_DATABASE_URL ?? null, backup: null, yes: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--list":
        args.list = true;
        break;
      case "--target":
        args.target = argv[++i] ?? null;
        break;
      case "--backup":
        args.backup = argv[++i] ?? null;
        break;
      case "--yes":
        args.yes = true;
        break;
      default:
        throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

function redact(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "(unparseable connection string)";
  }
}

function formatAge(uploadedAt: Date): string {
  const days = (Date.now() - uploadedAt.getTime()) / (24 * 60 * 60 * 1000);
  if (days < 1) return "today";
  if (days < 2) return "1 day ago";
  return `${Math.floor(days)} days ago`;
}

async function printBackupList(backups: BackupBlob[]) {
  console.log(`${backups.length} backup(s) found:\n`);
  for (const b of backups) {
    const mb = (b.size / (1024 * 1024)).toFixed(1);
    console.log(`  ${b.pathname}  (${formatAge(b.uploadedAt)}, ${mb} MB)`);
  }
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return answer.trim() === "RESTORE";
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const backups = await listBackups();
  if (backups.length === 0) {
    throw new Error("No backups found — nothing to restore.");
  }

  if (args.list) {
    await printBackupList(backups);
    return;
  }

  if (!args.target) {
    throw new Error("Missing target database. Pass --target \"<connection string>\" or set RESTORE_TARGET_DATABASE_URL.");
  }
  const passphrase = process.env.BACKUP_ENCRYPTION_KEY;
  if (!passphrase) {
    throw new Error("Missing BACKUP_ENCRYPTION_KEY in the environment — can't decrypt any backup without it.");
  }

  const chosen = args.backup ? backups.find((b) => b.pathname === args.backup) : backups[0];
  if (!chosen) {
    throw new Error(`Backup not found: ${args.backup}. Run with --list to see what's available.`);
  }

  console.log("About to restore:");
  console.log(`  Backup: ${chosen.pathname} (${formatAge(chosen.uploadedAt)}, uploaded ${chosen.uploadedAt.toISOString()})`);
  console.log(`  Target: ${redact(args.target)}`);
  console.log("\nThis OVERWRITES existing data in the target database.\n");

  if (!args.yes) {
    const confirmed = await confirm('Type "RESTORE" to continue: ');
    if (!confirmed) {
      console.log("Aborted — no changes made.");
      return;
    }
  }

  const workDir = mkdtempSync(join(tmpdir(), "birava-restore-"));
  const encryptedPath = join(workDir, "backup.dump.gpg");
  const decryptedPath = join(workDir, "backup.dump");

  try {
    console.log(`\nDownloading ${chosen.pathname}...`);
    await downloadBackup(chosen, encryptedPath);

    console.log("Decrypting...");
    execFileSync(
      "gpg",
      ["--batch", "--yes", "--passphrase", passphrase, "--decrypt", "--output", decryptedPath, encryptedPath],
      { stdio: ["ignore", "inherit", "inherit"] }
    );

    console.log("Restoring into target (pg_restore, via Docker for version-matched tooling)...");
    execFileSync(
      "docker",
      [
        "run",
        "--rm",
        "-v",
        `${decryptedPath}:/backup.dump:ro`,
        "postgres:18-alpine",
        "pg_restore",
        "--no-owner",
        "--no-privileges",
        "--clean",
        "--if-exists",
        `--dbname=${args.target}`,
        "/backup.dump",
      ],
      { stdio: "inherit" }
    );

    console.log("Verifying restored data...");
    const target = new PrismaClient({ datasourceUrl: args.target });
    try {
      const result = await verifyRestoredDatabase(target);
      console.log(`Restored counts — users: ${result.users}, check-ins: ${result.entries}, sessions: ${result.sessions}`);
    } finally {
      await target.$disconnect();
    }

    console.log("\nRestore complete. Remaining manual steps:");
    console.log("  1. Point the app's DATABASE_URL (Vercel env vars) at this target, if it isn't already.");
    console.log("  2. Update PROD_DATABASE_URL_DIRECT in GitHub secrets if the target is new, so tonight's backup targets it too.");
    console.log("  3. Redeploy and spot-check the app before considering this done.");
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
