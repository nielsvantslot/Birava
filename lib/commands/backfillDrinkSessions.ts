import type { PrismaClient } from "@prisma/client";
import { groupIntoSessions } from "@/lib/sessions";
import { toDrinkEntry } from "@/lib/mappers/checkin/checkinMapper";

/**
 * Computes DrinkSession rows for every DrinkEntry that doesn't have one yet,
 * using the same 4-hour-gap clustering as groupIntoSessions(), and sets
 * DrinkEntry.sessionId to match. Shared by scripts/backfill-drink-sessions.ts
 * (the one-time production backfill) and prisma/seed.ts (so seeded demo data
 * gets real sessions too) — both against their own PrismaClient instance.
 */
export async function backfillDrinkSessions(
  db: PrismaClient
): Promise<{ sessionsCreated: number }> {
  const rows = await db.drinkEntry.findMany({
    where: { sessionId: null },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) return { sessionsCreated: 0 };

  const sessions = groupIntoSessions(rows.map(toDrinkEntry));

  await db.$transaction(
    sessions.flatMap((session) => [
      db.drinkSession.create({
        data: {
          id: session.id,
          userId: session.userId,
          startedAt: new Date(session.start),
          endedAt: new Date(session.end),
        },
      }),
      db.drinkEntry.updateMany({
        where: { id: { in: session.checkins.map((c) => c.id) } },
        data: { sessionId: session.id },
      }),
    ])
  );

  return { sessionsCreated: sessions.length };
}
