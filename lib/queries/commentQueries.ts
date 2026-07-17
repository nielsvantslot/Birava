import { db } from "@/lib/db";
import { CommentMapper } from "@/lib/mappers";
import type { CommentDTO } from "@/lib/dtos";

/** Comment counts for a set of session ids, in one grouped query. */
export async function getCommentCounts(
  sessionIds: string[]
): Promise<Map<string, number>> {
  if (sessionIds.length === 0) return new Map();

  const counts = await db.comment.groupBy({
    by: ["sessionId"],
    where: { sessionId: { in: sessionIds } },
    _count: { sessionId: true },
  });

  const map = new Map<string, number>();
  for (const id of sessionIds) map.set(id, 0);
  for (const c of counts) map.set(c.sessionId, c._count.sessionId);
  return map;
}

/** Full comment threads (oldest first) for a set of session ids. */
export async function getSessionComments(
  sessionIds: string[]
): Promise<Map<string, CommentDTO[]>> {
  if (sessionIds.length === 0) return new Map();

  const rows = await db.comment.findMany({
    where: { sessionId: { in: sessionIds } },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { username: true, avatarUrl: true } } },
  });

  const map = new Map<string, CommentDTO[]>();
  for (const id of sessionIds) map.set(id, []);
  for (const row of rows) {
    map.get(row.sessionId)!.push(CommentMapper.toDTO(row));
  }
  return map;
}
