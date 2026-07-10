import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { DrinkEntryMapper, toDrinkEntry } from "@/lib/mappers";
import { DrinkEntryWithAuthorDTO } from "@/lib/dtos";
import { getFollowingIds, isFollowing } from "@/lib/queries/followQueries";
import type { DrinkEntry } from "@/lib/types";

const ENTRY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function canViewDrinkEntry(
  entry: { userId: string; groupId: string | null },
  viewerId: string
): Promise<boolean> {
  if (entry.userId === viewerId) return true;

  if (entry.groupId) {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: entry.groupId, userId: viewerId } },
    });
    if (membership) return true;
  }

  return isFollowing(viewerId, entry.userId);
}

/**
 * Resolve the storage URL of a photo the viewer is allowed to see, without
 * reading the bytes. Lets the route emit an ETag and answer conditional
 * requests with a 304 (no storage read) — see the photos route.
 */
export async function getViewableDrinkPhotoUrl(
  viewerId: string,
  entryId: string
): Promise<string | null> {
  if (!ENTRY_ID_PATTERN.test(entryId)) return null;

  const entry = await db.drinkEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, groupId: true, photoUrl: true },
  });
  if (!entry || !entry.photoUrl) return null;

  const allowed = await canViewDrinkEntry(entry, viewerId);
  if (!allowed) return null;

  return entry.photoUrl;
}

export async function getSocialFeed(
  userId: string,
  options: { limit: number; offset: number }
): Promise<DrinkEntryWithAuthorDTO[]> {
  const ids = await getFollowingIds(userId);
  if (ids.length === 0) return [];

  const entries = await db.drinkEntry.findMany({
    where: { userId: { in: ids } },
    include: { user: { select: { username: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    skip: options.offset,
    take: options.limit,
  });

  return entries.map((entry) => DrinkEntryMapper.toDTOWithAuthor(entry));
}

export function drinkHistoryTag(userId: string): string {
  return `drink-history:${userId}`;
}

/**
 * Full check-in history for the session-derived screens (stats, achievements,
 * profile). Returns the legacy snake_case `DrinkEntry` shape because the session
 * engine (groupIntoSessions / computeAchievements / activeWeeks in lib/sessions
 * + lib/achievements) is built on it — the same shape the DTO-returning reads
 * above deliberately don't produce.
 *
 * The full history can't be paginated (streaks/achievements need every row), so
 * it's cached per user instead: `revalidateTag(drinkHistoryTag(userId))` fires
 * from drinkController's mutation actions, with a 60s revalidate as a backstop.
 */
export async function getDrinkHistory(userId: string): Promise<DrinkEntry[]> {
  return unstable_cache(
    async () => {
      const entries = await db.drinkEntry.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
      return entries.map(toDrinkEntry);
    },
    ["drink-history", userId],
    { tags: [drinkHistoryTag(userId)], revalidate: 60 }
  )();
}

/**
 * Merged feed (viewer + followed) for the dashboard, newest first, capped at
 * 150. Legacy `DrinkEntry` shape (with author) for the same session-engine
 * reason as getDrinkHistory.
 *
 * Cached per unique set of userIds, tagged with each contributing user's
 * drinkHistoryTag so it's busted the moment any of them logs/edits/deletes a
 * check-in (revalidateDrinkPaths already fires that tag today).
 */
export async function getFeedDrinkHistory(
  userIds: string[]
): Promise<DrinkEntry[]> {
  const cacheKey = [...userIds].sort().join(",");
  return unstable_cache(
    async () => {
      const entries = await db.drinkEntry.findMany({
        where: { userId: { in: userIds } },
        include: { user: { select: { username: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
        take: 150,
      });
      return entries.map(toDrinkEntry);
    },
    ["feed-drink-history", cacheKey],
    { tags: userIds.map(drinkHistoryTag), revalidate: 60 }
  )();
}

const SESSION_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * The ±48h check-in window around an anchor's owner, from which the session
 * is recomputed (sessions are never stored). Legacy `DrinkEntry` shape.
 */
export async function getSessionWindow(
  anchorId: string
): Promise<DrinkEntry[] | null> {
  const anchor = await db.drinkEntry.findUnique({
    where: { id: anchorId },
    select: { userId: true, createdAt: true },
  });
  if (!anchor) return null;

  const neighbours = await db.drinkEntry.findMany({
    where: {
      userId: anchor.userId,
      createdAt: {
        gte: new Date(anchor.createdAt.getTime() - SESSION_WINDOW_MS),
        lte: new Date(anchor.createdAt.getTime() + SESSION_WINDOW_MS),
      },
    },
    include: { user: { select: { username: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
  return neighbours.map(toDrinkEntry);
}

/** A single own check-in (for the edit form). Legacy `DrinkEntry` shape. */
export async function getDrinkEntryForUser(
  userId: string,
  id: string
): Promise<DrinkEntry | null> {
  const entry = await db.drinkEntry.findFirst({ where: { id, userId } });
  return entry ? toDrinkEntry(entry) : null;
}

/** A user's most recent check-ins (the "Recent" list on /log). */
export async function getRecentDrinkHistory(
  userId: string,
  limit: number
): Promise<DrinkEntry[]> {
  const entries = await db.drinkEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return entries.map(toDrinkEntry);
}
