import { db } from "@/lib/db";
import { readDrinkPhoto } from "@/lib/storage";
import { DrinkEntryMapper, toBeerEntry } from "@/lib/mappers";
import { DrinkEntryDTO, DrinkEntryWithAuthorDTO } from "@/lib/dtos";
import { getFollowingIds, isFollowing } from "@/lib/queries/followQueries";
import type { BeerEntry } from "@/lib/types";

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

export async function getViewableDrinkPhoto(viewerId: string, entryId: string) {
  const photoUrl = await getViewableDrinkPhotoUrl(viewerId, entryId);
  if (!photoUrl) return null;

  return readDrinkPhoto(photoUrl);
}

export async function getDrinkEntriesByUser(
  userId: string,
  options: { orderByCreatedAt: "asc" | "desc"; limit?: number }
): Promise<DrinkEntryDTO[]> {
  const entries = await db.drinkEntry.findMany({
    where: { userId },
    orderBy: { createdAt: options.orderByCreatedAt },
    ...(options.limit ? { take: options.limit } : {}),
  });

  return entries.map((entry) => DrinkEntryMapper.toDTO(entry));
}

export async function getDrinkEntriesForUsers(
  userIds: string[],
  options: { onlyWithPhoto?: boolean; orderByCreatedAt?: "asc" | "desc"; limit?: number } = {}
): Promise<DrinkEntryWithAuthorDTO[]> {
  const entries = await db.drinkEntry.findMany({
    where: {
      userId: { in: userIds },
      ...(options.onlyWithPhoto ? { photoUrl: { not: null } } : {}),
    },
    include: { user: { select: { username: true, avatarUrl: true } } },
    ...(options.orderByCreatedAt ? { orderBy: { createdAt: options.orderByCreatedAt } } : {}),
    ...(options.limit ? { take: options.limit } : {}),
  });

  return entries.map((entry) => DrinkEntryMapper.toDTOWithAuthor(entry));
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

/**
 * Full check-in history for the session-derived screens (stats, achievements,
 * profile). Returns the legacy snake_case `BeerEntry` shape because the session
 * engine (groupIntoSessions / computeAchievements / activeWeeks in lib/sessions
 * + lib/achievements) is built on it — the same shape the DTO-returning reads
 * above deliberately don't produce.
 */
export async function getDrinkHistory(userId: string): Promise<BeerEntry[]> {
  const entries = await db.drinkEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return entries.map(toBeerEntry);
}

/**
 * Merged feed (viewer + followed) for the dashboard, newest first, capped at
 * 150. Legacy `BeerEntry` shape (with author) for the same session-engine
 * reason as getDrinkHistory.
 */
export async function getFeedDrinkHistory(
  userIds: string[]
): Promise<BeerEntry[]> {
  const entries = await db.drinkEntry.findMany({
    where: { userId: { in: userIds } },
    include: { user: { select: { username: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  return entries.map(toBeerEntry);
}
