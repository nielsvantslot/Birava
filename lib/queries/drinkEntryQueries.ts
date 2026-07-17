import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { DrinkEntryMapper, toDrinkEntry } from "@/lib/mappers";
import { DrinkEntryWithAuthorDTO } from "@/lib/dtos";
import { getFollowingIds } from "@/lib/queries/followQueries";
import type { DrinkEntry } from "@/lib/types";

const ENTRY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve the storage URL of a check-in's photo for serving, without reading
 * the bytes (lets the route emit an ETag and answer conditional requests with
 * a 304 — see the photos route).
 *
 * No per-viewer visibility gate: a check-in always belongs to a DrinkSession,
 * and a session is shareable by link with no follow/ownership check
 * (getSessionById) — the recap is public by design. So a session's photos are
 * viewable by any authenticated viewer along with the rest of the recap
 * (issue #99); previously the blur placeholder rendered but the real bytes
 * 404'd for non-followers, which read as broken. The photos route still
 * requires a logged-in user via requireUser.
 */
export async function getViewableDrinkPhotoUrl(
  entryId: string
): Promise<string | null> {
  if (!ENTRY_ID_PATTERN.test(entryId)) return null;

  const entry = await db.drinkEntry.findUnique({
    where: { id: entryId },
    select: { photoUrl: true },
  });
  return entry?.photoUrl ?? null;
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
