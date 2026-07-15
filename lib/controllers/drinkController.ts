"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { NOT_AUTHENTICATED } from "@/lib/auth/authErrors";
import { createDrinkEntry, updateDrinkEntry, deleteDrinkEntry } from "@/lib/commands/drinkEntryCommands";
import {
  getDrinkHistory,
  getFeedDrinkHistory,
  getDrinkEntryForUser,
  getRecentDrinkHistory,
  drinkHistoryTag,
} from "@/lib/queries/drinkEntryQueries";
import {
  getSessionById,
  getSessionsForUserIds,
  getAllSessionsForUser,
} from "@/lib/queries/drinkSessionQueries";
import { getFollowingIds } from "@/lib/queries/followQueries";
import type { DrinkEntry } from "@/lib/types";
import type { DrinkSession } from "@/lib/sessions";
import {
  ActionResultDTO,
  AddDrinkResultDTO,
  CreateDrinkEntryDTO,
  DeleteDrinkEntryDTO,
  GetDrinkHistoryForUserDTO,
  GetMyDrinkEntryDTO,
  GetMyFeedDTO,
  GetMyRecentDrinksDTO,
  GetSessionDTO,
  GetSessionsForUserDTO,
  UpdateDrinkEntryDTO,
} from "@/lib/dtos";

/** Feed sessions fetched per page — matches the dashboard's current page size. */
const FEED_SESSION_LIMIT = 12;

const DRINK_PATHS = ["/dashboard", "/stats", "/log", "/profile", "/achievements"];

function revalidateDrinkPaths(userId: string) {
  for (const path of DRINK_PATHS) revalidatePath(path);
  revalidatePath("/sessions", "layout");
  revalidatePath("/crews", "layout");
  revalidateTag(drinkHistoryTag(userId));
}

export async function addDrink(input: CreateDrinkEntryDTO): Promise<AddDrinkResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await createDrinkEntry(user.id, input, {
    username: user.username,
    avatarUrl: user.avatarUrl,
  });
  if (!result.error) revalidateDrinkPaths(user.id);
  return result;
}

export async function editDrink(input: UpdateDrinkEntryDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await updateDrinkEntry(user.id, input);
  if (!result.error) revalidateDrinkPaths(user.id);
  return result;
}

export async function deleteDrink(input: DeleteDrinkEntryDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await deleteDrinkEntry(user.id, input);
  if (!result.error) revalidateDrinkPaths(user.id);
  return result;
}

// The reads below return the legacy `DrinkEntry` shape (not DrinkEntryDTO)
// because they feed the session engine (groupIntoSessions / computeAchievements
// / activeWeeks), which is built on it. Same reason the mapper still exports
// toDrinkEntry. Controllers stay the frontend's only entry point.

/** Current user's full history for the session-derived screens (stats, achievements, own profile). */
export async function getMyDrinkHistory(): Promise<DrinkEntry[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return getDrinkHistory(user.id);
}

/** Another user's history for the public profile. Public read (no auth). */
export async function getDrinkHistoryForUser(
  input: GetDrinkHistoryForUserDTO
): Promise<DrinkEntry[]> {
  return getDrinkHistory(input.userId);
}

/** The dashboard feed: viewer alone ("You" tab) or viewer + everyone they follow. */
export async function getMyFeed(input: GetMyFeedDTO): Promise<DrinkEntry[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const userIds = input.onlyOwn
    ? [user.id]
    : [user.id, ...(await getFollowingIds(user.id))];
  return getFeedDrinkHistory(userIds);
}

/** A single session by id — the session detail page + share-image route. */
export async function getSession(input: GetSessionDTO): Promise<DrinkSession | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  return getSessionById(input.id);
}

/** The dashboard feed's sessions: viewer alone ("You" tab) or viewer + everyone they follow. */
export async function getMyFeedSessions(input: GetMyFeedDTO): Promise<DrinkSession[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const userIds = input.onlyOwn
    ? [user.id]
    : [user.id, ...(await getFollowingIds(user.id))];
  return getSessionsForUserIds(userIds, { limit: FEED_SESSION_LIMIT });
}

/**
 * A user's most recent sessions (profile "Recent sessions" list). Public
 * read (no auth) — same as getDrinkHistoryForUser — since both the own and
 * public profile pages use it.
 */
export async function getRecentSessionsForUser(
  input: GetSessionsForUserDTO
): Promise<DrinkSession[]> {
  return getSessionsForUserIds([input.userId], { limit: input.limit });
}

/** One of the current user's own check-ins (for the edit form). */
export async function getMyDrinkEntry(
  input: GetMyDrinkEntryDTO
): Promise<DrinkEntry | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  return getDrinkEntryForUser(user.id, input.id);
}

/** The current user's most recent check-ins (the "Recent" list on /log). */
export async function getMyRecentDrinks(
  input: GetMyRecentDrinksDTO
): Promise<DrinkEntry[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return getRecentDrinkHistory(user.id, input.limit);
}
