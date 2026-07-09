import { db } from "@/lib/db";

export type ProostState = { count: number; on: boolean };

/**
 * Proost counts + viewer-state for a set of session anchor ids.
 * Server-side read helper (not a server action).
 */
export async function getProostStates(
  entryIds: string[],
  viewerId: string
): Promise<Map<string, ProostState>> {
  if (entryIds.length === 0) return new Map();

  const [counts, own] = await Promise.all([
    db.proost.groupBy({
      by: ["entryId"],
      where: { entryId: { in: entryIds } },
      _count: { entryId: true },
    }),
    db.proost.findMany({
      where: { entryId: { in: entryIds }, userId: viewerId },
      select: { entryId: true },
    }),
  ]);

  const mine = new Set(own.map((p) => p.entryId));
  const map = new Map<string, ProostState>();
  for (const id of entryIds) map.set(id, { count: 0, on: mine.has(id) });
  for (const c of counts) {
    map.set(c.entryId, { count: c._count.entryId, on: mine.has(c.entryId) });
  }
  return map;
}
