import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { statsEntrySelect, toBeerEntry, toStatsEntry } from "@/lib/mappers";
import type { BeerEntry } from "@/lib/types";

/**
 * Server-render cache (Layer 2). These reads are tagged with `user:<id>` for
 * every user whose check-ins they contain, and invalidated event-driven by the
 * write actions via `updateTag` — so the cache can never hide a fresh check-in:
 * logging busts every cached view that includes the writer. `cacheLife` is only
 * a safety-net TTL, not the freshness mechanism.
 *
 * Cookies/headers are never read here (a `use cache` constraint); the caller
 * reads them and passes ids/tz in as arguments.
 */

/**
 * A user's full check-in history, projected to the columns the stats /
 * achievements / profile screens compute from. Tagged `user:<userId>` — only
 * that user's own writes can change it. Time-zone-independent (the tz-dependent
 * math happens in the page from this cached array).
 */
export async function getUserHistory(userId: string): Promise<BeerEntry[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`);

  const rows = await db.beerEntry.findMany({
    where: { userId },
    select: statsEntrySelect,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toStatsEntry);
}

/**
 * The merged session feed: the 150 most recent check-ins across the given
 * users (viewer + followed). Tagged with `user:<id>` for each, so any one
 * member's check-in invalidates exactly the feeds that include them.
 */
export async function getFeedEntries(userIds: string[]): Promise<BeerEntry[]> {
  "use cache";
  cacheLife("minutes");
  for (const id of userIds) cacheTag(`user:${id}`);

  const rows = await db.beerEntry.findMany({
    where: { userId: { in: userIds } },
    include: { user: { select: { username: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  return rows.map(toBeerEntry);
}
