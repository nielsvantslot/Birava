import type { PrismaClient } from "@prisma/client";

export type RestoreVerificationResult = {
  users: number;
  entries: number;
  sessions: number;
};

/**
 * "Did real data actually come back", not a byte-for-byte comparison
 * against production (whatever it's being compared to has moved on by the
 * time this runs) — just enough tables to catch a restore that silently
 * produced an empty-but-structurally-valid database.
 */
export async function verifyRestoredDatabase(db: PrismaClient): Promise<RestoreVerificationResult> {
  const [users, entries, sessions] = await Promise.all([
    db.user.count(),
    db.drinkEntry.count(),
    db.drinkSession.count(),
  ]);

  const result = { users, entries, sessions };
  const empty = Object.entries(result).filter(([, count]) => count === 0);
  if (empty.length > 0) {
    throw new Error(`Restore verification failed — empty tables: ${empty.map(([name]) => name).join(", ")}`);
  }

  return result;
}
