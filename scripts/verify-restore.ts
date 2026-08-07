/**
 * Sanity check for .github/workflows/restore-drill.yml: after pg_restore
 * into a scratch Neon branch, confirm the restored database actually has
 * real rows in it — an untested backup is a hypothesis, not a backup.
 *
 * Relies on DATABASE_URL already pointing at the scratch branch (set by
 * the workflow step before this runs) — reuses lib/db.ts's PrismaClient
 * exactly like the rest of the app.
 */
import { db } from "../lib/db";
import { verifyRestoredDatabase } from "../lib/backupVerification";

async function main() {
  const result = await verifyRestoredDatabase(db);
  console.log(`Restored counts — users: ${result.users}, check-ins: ${result.entries}, sessions: ${result.sessions}`);
  console.log("Restore verification passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
