import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { toDrinkEntry } from "@/lib/mappers";
import { assembleDrinkSession, type DrinkSession } from "@/lib/sessions";
import { drinkHistoryTag } from "@/lib/queries/drinkEntryQueries";
import type { DrinkEntry, DrinkSession as DrinkSessionRow, User } from "@prisma/client";

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SessionRowWithRelations = DrinkSessionRow & {
  user: Pick<User, "username" | "avatarUrl">;
  entries: DrinkEntry[];
};

function toDrinkSession(row: SessionRowWithRelations): DrinkSession {
  return assembleDrinkSession(
    {
      id: row.id,
      userId: row.userId,
      username: row.user.username,
      avatarUrl: row.user.avatarUrl,
      start: row.startedAt.toISOString(),
      end: row.endedAt.toISOString(),
    },
    row.entries.map(toDrinkEntry)
  );
}

/** A single session by id — a direct lookup, since sessions are real rows. */
export async function getSessionById(id: string): Promise<DrinkSession | null> {
  if (!SESSION_ID_PATTERN.test(id)) return null;

  const row = await db.drinkSession.findUnique({
    where: { id },
    include: {
      user: { select: { username: true, avatarUrl: true } },
      entries: { orderBy: { createdAt: "asc" } },
    },
  });
  return row ? toDrinkSession(row) : null;
}

export type SessionCursor = { endedAt: Date; id: string };

/**
 * A page of sessions across a set of user ids, newest-ended first — the
 * dashboard feed's source now, instead of overfetching 150 raw check-ins
 * and grouping/slicing them in JS.
 *
 * `before` is a keyset cursor (the last item of the previous page), not an
 * offset: "give me rows older than this" is immune to a concurrent insert
 * shifting positions, unlike `skip: N`, which can silently duplicate or
 * skip a row if someone logs a new check-in between two page fetches.
 * `endedAt` ties are broken by `id` (both in the WHERE and the ORDER BY) so
 * pagination stays stable even if two sessions end at the exact same
 * millisecond.
 *
 * Cached per unique set of userIds + limit + cursor, tagged with each
 * contributing user's drinkHistoryTag so it's busted the moment any of them
 * logs/edits/deletes a check-in (revalidateDrinkPaths already fires that
 * tag today).
 */
export async function getSessionsForUserIds(
  userIds: string[],
  options: { limit?: number; before?: SessionCursor } = {}
): Promise<DrinkSession[]> {
  if (userIds.length === 0) return [];

  const cacheKey =
    [...userIds].sort().join(",") +
    `:${options.limit ?? "all"}` +
    `:${options.before ? `${options.before.endedAt.toISOString()}_${options.before.id}` : "first"}`;

  return unstable_cache(
    async () => {
      const rows = await db.drinkSession.findMany({
        where: {
          userId: { in: userIds },
          ...(options.before && {
            OR: [
              { endedAt: { lt: options.before.endedAt } },
              { endedAt: options.before.endedAt, id: { lt: options.before.id } },
            ],
          }),
        },
        orderBy: [{ endedAt: "desc" }, { id: "desc" }],
        take: options.limit,
        include: {
          user: { select: { username: true, avatarUrl: true } },
          entries: { orderBy: { createdAt: "asc" } },
        },
      });
      return rows.map(toDrinkSession);
    },
    ["sessions-for-users", cacheKey],
    { tags: userIds.map(drinkHistoryTag), revalidate: 60 }
  )();
}
