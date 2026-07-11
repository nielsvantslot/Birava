import { db } from "@/lib/db";
import { CommentMapper } from "@/lib/mappers";
import type { CommentDTO } from "@/lib/dtos";

/** Comment counts for a set of session anchor ids, in one grouped query. */
export async function getCommentCounts(
  entryIds: string[]
): Promise<Map<string, number>> {
  if (entryIds.length === 0) return new Map();

  const counts = await db.comment.groupBy({
    by: ["entryId"],
    where: { entryId: { in: entryIds } },
    _count: { entryId: true },
  });

  const map = new Map<string, number>();
  for (const id of entryIds) map.set(id, 0);
  for (const c of counts) map.set(c.entryId, c._count.entryId);
  return map;
}

/** Full comment threads (oldest first) for a set of session anchor ids. */
export async function getSessionComments(
  entryIds: string[]
): Promise<Map<string, CommentDTO[]>> {
  if (entryIds.length === 0) return new Map();

  const rows = await db.comment.findMany({
    where: { entryId: { in: entryIds } },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { username: true, avatarUrl: true } } },
  });

  const map = new Map<string, CommentDTO[]>();
  for (const id of entryIds) map.set(id, []);
  for (const row of rows) {
    map.get(row.entryId)!.push(CommentMapper.toDTO(row));
  }
  return map;
}
