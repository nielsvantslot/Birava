import { db } from "@/lib/db";
import { statsEntrySelect, toBeerEntry, toStatsEntry } from "@/lib/mappers";
import type { BeerEntry } from "@/lib/types";

/**
 * Centralised history reads. These project only the columns the consuming
 * screens actually use, which keeps Prisma from hydrating (and Node from
 * deserialising) the Decimal columns on long histories — the dominant cost
 * on the stats/achievements/profile screens.
 *
 * (A server-render cache layer once wrapped these with `"use cache"` +
 * `cacheTag`; that's a Next 16 feature and the app runs on 15.5, so they're
 * plain reads for now. The projection + parallelised callers still stand.)
 */

/**
 * A user's full check-in history, projected to the columns the stats /
 * achievements / profile screens compute from (session grouping, achievements,
 * active-weeks). Time-zone-independent — the tz math happens in the page.
 */
export async function getUserHistory(userId: string): Promise<BeerEntry[]> {
  const rows = await db.drinkEntry.findMany({
    where: { userId },
    select: statsEntrySelect,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toStatsEntry);
}

/**
 * The merged session feed: the 150 most recent check-ins across the given
 * users (viewer + followed). Full rows (photos, coordinates, author) since the
 * feed cards render them.
 */
export async function getFeedEntries(userIds: string[]): Promise<BeerEntry[]> {
  const rows = await db.drinkEntry.findMany({
    where: { userId: { in: userIds } },
    include: { user: { select: { username: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  return rows.map(toBeerEntry);
}
