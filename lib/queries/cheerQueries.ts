import { db } from "@/lib/db";

export type CheerState = { count: number; on: boolean };

/**
 * Cheer counts + viewer-state for a set of session ids, in one batched pair
 * of queries (count grouped + the viewer's own rows).
 */
export async function getCheerStates(
  sessionIds: string[],
  viewerId: string
): Promise<Map<string, CheerState>> {
  if (sessionIds.length === 0) return new Map();

  const [counts, own] = await Promise.all([
    db.cheer.groupBy({
      by: ["sessionId"],
      where: { sessionId: { in: sessionIds } },
      _count: { sessionId: true },
    }),
    db.cheer.findMany({
      where: { sessionId: { in: sessionIds }, userId: viewerId },
      select: { sessionId: true },
    }),
  ]);

  const mine = new Set(own.map((p) => p.sessionId));
  const map = new Map<string, CheerState>();
  for (const id of sessionIds) map.set(id, { count: 0, on: mine.has(id) });
  for (const c of counts) {
    map.set(c.sessionId, { count: c._count.sessionId, on: mine.has(c.sessionId) });
  }
  return map;
}
