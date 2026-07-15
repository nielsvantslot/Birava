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

/**
 * A single session by id — replaces the old ±48h-window-then-re-derive
 * approach (getSessionWindow + findSessionWithCheckin): sessions are real
 * rows now, so this is a direct lookup instead of a recomputation.
 */
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

/**
 * A page of sessions across a set of user ids, newest-ended first — the
 * dashboard feed's source now, instead of overfetching 150 raw check-ins
 * and grouping/slicing them in JS.
 *
 * Cached per unique set of userIds + limit, tagged with each contributing
 * user's drinkHistoryTag so it's busted the moment any of them
 * logs/edits/deletes a check-in (revalidateDrinkPaths already fires that
 * tag today).
 */
export async function getSessionsForUserIds(
  userIds: string[],
  options: { limit?: number } = {}
): Promise<DrinkSession[]> {
  if (userIds.length === 0) return [];

  const cacheKey = [...userIds].sort().join(",") + `:${options.limit ?? "all"}`;
  return unstable_cache(
    async () => {
      const rows = await db.drinkSession.findMany({
        where: { userId: { in: userIds } },
        orderBy: { endedAt: "desc" },
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

/** Every session for one user — stats/profile/achievements/crews need full history (streaks can't be paginated). */
export async function getAllSessionsForUser(userId: string): Promise<DrinkSession[]> {
  return getSessionsForUserIds([userId]);
}
