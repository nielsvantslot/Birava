/**
 * One-time backfill: computes DrinkSession rows for existing check-in
 * history and sets DrinkEntry.sessionId to match (see
 * lib/commands/backfillDrinkSessions.ts for the actual clustering). Run
 * once, manually, after the add_drink_session migration and before
 * DrinkEntry.sessionId is made NOT NULL — unlike
 * scripts/backfill-photo-derivatives.ts, this isn't meant to run on every
 * deploy (it must fully complete before the later NOT NULL migration), but
 * it's still safe to re-run: it only looks at entries without a sessionId
 * yet, and the whole backfill applies atomically.
 *
 * Usage: docker exec birava-app npx tsx scripts/backfill-drink-sessions.ts
 */
import { PrismaClient } from "@prisma/client";
import { backfillDrinkSessions } from "../lib/commands/backfillDrinkSessions";

const db = new PrismaClient();

backfillDrinkSessions(db)
  .then(({ sessionsCreated }) => {
    console.log(`[backfill-drink-sessions] done: ${sessionsCreated} sessions created`);
  })
  .catch((err) => {
    console.error("[backfill-drink-sessions] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
