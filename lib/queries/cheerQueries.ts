import { db } from "@/lib/db";

export type CheerState = { count: number; on: boolean };

/**
 * Cheer counts + viewer-state for a set of session anchor ids, in one
 * batched pair of queries (count grouped + the viewer's own rows).
 */
export async function getCheerStates(
  entryIds: string[],
  viewerId: string
): Promise<Map<string, CheerState>> {
  if (entryIds.length === 0) return new Map();

  const [counts, own] = await Promise.all([
    db.cheer.groupBy({
      by: ["entryId"],
      where: { entryId: { in: entryIds } },
      _count: { entryId: true },
    }),
    db.cheer.findMany({
      where: { entryId: { in: entryIds }, userId: viewerId },
      select: { entryId: true },
    }),
  ]);

  const mine = new Set(own.map((p) => p.entryId));
  const map = new Map<string, CheerState>();
  for (const id of entryIds) map.set(id, { count: 0, on: mine.has(id) });
  for (const c of counts) {
    map.set(c.entryId, { count: c._count.entryId, on: mine.has(c.entryId) });
  }
  return map;
}
