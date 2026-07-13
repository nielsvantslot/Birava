/**
 * Reprocesses existing check-in photos through the same resize/EXIF-strip/
 * WebP/LQIP pipeline new uploads already use (modules/photo-upload/), so
 * photos uploaded before that pipeline existed converge to the same format
 * as new ones.
 *
 * Runs automatically on every staging/production deploy (vercel.json). Safe
 * to run on every deploy indefinitely:
 *  - Idempotent: a row only matches while photoLqip is still null, so an
 *    already-backfilled row drops out of the next run's query on its own —
 *    no separate "done" flag needed.
 *  - Bounded: processes at most BATCH_SIZE rows per invocation, so a large
 *    backlog drains over several deploys instead of one long build step.
 *  - Never fails the build: a bad row (corrupt file, missing blob, etc.) is
 *    logged and skipped; the process always exits 0.
 */
import { PrismaClient } from "@prisma/client";
import { drinkPhotoService } from "../lib/photoUpload";

const db = new PrismaClient();

const BATCH_SIZE = 25;

type BackfillOutcome = "backfilled" | "skipped";

async function backfillRow(entry: { id: string; userId: string; photoUrl: string }): Promise<BackfillOutcome> {
  // Check existence separately from reprocessStored() so a missing blob (an
  // expected, non-error case) doesn't get lumped in with real decode
  // failures below — those should propagate to main()'s catch and count as
  // "failed" with the actual error logged, not silently counted as "skipped".
  const original = await drinkPhotoService.read(entry.photoUrl);
  if (!original) {
    console.warn(`[backfill] ${entry.id}: stored photo not found, skipping`);
    return "skipped";
  }

  const reprocessed = await drinkPhotoService.reprocessStored(entry.photoUrl, entry.userId);

  // Update the row before deleting the old blob — if this fails, the row
  // still points at a valid (old) photo instead of a deleted one.
  await db.drinkEntry.update({
    where: { id: entry.id },
    data: { photoUrl: reprocessed.url, photoLqip: reprocessed.lqip },
  });

  await drinkPhotoService.remove(entry.photoUrl, entry.userId);
  return "backfilled";
}

async function main() {
  const rows = await db.drinkEntry.findMany({
    where: { photoUrl: { not: null }, photoLqip: null },
    select: { id: true, userId: true, photoUrl: true },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  if (rows.length === 0) {
    console.log("[backfill] no rows need backfilling");
    return;
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    if (!row.photoUrl) continue; // query already guarantees this; narrows the type
    try {
      const outcome = await backfillRow({ id: row.id, userId: row.userId, photoUrl: row.photoUrl });
      if (outcome === "backfilled") ok++;
      else skipped++;
    } catch (err) {
      failed++;
      console.error(`[backfill] ${row.id}: failed —`, err);
    }
  }

  const remaining = await db.drinkEntry.count({
    where: { photoUrl: { not: null }, photoLqip: null },
  });

  console.log(`[backfill] done: ${ok} backfilled, ${skipped} skipped, ${failed} failed, ${remaining} remaining`);
}

main()
  .catch((err) => {
    // Never fail the deploy over this — log and move on.
    console.error("[backfill] unexpected error, skipping this deploy's run:", err);
  })
  .finally(() => db.$disconnect());
