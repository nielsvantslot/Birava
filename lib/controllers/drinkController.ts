"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { NOT_AUTHENTICATED } from "@/lib/auth/authErrors";
import { createDrinkEntry, updateDrinkEntry, deleteDrinkEntry } from "@/lib/commands/drinkEntryCommands";
import {
  getDrinkEntriesByUser,
  getDrinkHistory,
  getFeedDrinkHistory,
  getSessionWindow,
  getDrinkEntryForUser,
  getRecentDrinkHistory,
} from "@/lib/queries/drinkEntryQueries";
import { getFollowingIds } from "@/lib/queries/followQueries";
import type { BeerEntry } from "@/lib/types";
import {
  ActionResultDTO,
  AddDrinkResultDTO,
  DrinkEntryDTO,
  CreateDrinkEntryDTO,
  DeleteDrinkEntryDTO,
  GetDrinkHistoryForUserDTO,
  GetMyDrinkEntriesDTO,
  GetMyDrinkEntryDTO,
  GetMyFeedDTO,
  GetMyRecentDrinksDTO,
  GetPublicDrinkEntriesForUserDTO,
  GetSessionCheckinsDTO,
  UpdateDrinkEntryDTO,
} from "@/lib/dtos";

const DRINK_PATHS = ["/dashboard", "/stats", "/log", "/profile", "/achievements"];
const MAX_PUBLIC_LIMIT = 50;

function revalidateDrinkPaths() {
  for (const path of DRINK_PATHS) revalidatePath(path);
  revalidatePath("/sessions", "layout");
  revalidatePath("/crews", "layout");
}

export async function addDrink(input: CreateDrinkEntryDTO): Promise<AddDrinkResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await createDrinkEntry(user.id, input);
  if (!result.error) revalidateDrinkPaths();
  return result;
}

export async function editDrink(input: UpdateDrinkEntryDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await updateDrinkEntry(user.id, input);
  if (!result.error) revalidateDrinkPaths();
  return result;
}

export async function deleteDrink(input: DeleteDrinkEntryDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await deleteDrinkEntry(user.id, input);
  if (!result.error) revalidateDrinkPaths();
  return result;
}

/** Always scoped to the current session's own id — the caller can never supply a different one. */
export async function getMyDrinkEntries(input: GetMyDrinkEntriesDTO): Promise<DrinkEntryDTO[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return getDrinkEntriesByUser(user.id, {
    orderByCreatedAt: input.orderByCreatedAt,
    limit: input.limit,
  });
}

/** Public read (no auth required, matches today's public-profile view) — `limit` is required and capped. */
export async function getPublicDrinkEntriesForUser(
  input: GetPublicDrinkEntriesForUserDTO
): Promise<DrinkEntryDTO[]> {
  return getDrinkEntriesByUser(input.userId, {
    orderByCreatedAt: "desc",
    limit: Math.min(input.limit, MAX_PUBLIC_LIMIT),
  });
}

// The reads below return the legacy `BeerEntry` shape (not DrinkEntryDTO)
// because they feed the session engine (groupIntoSessions / computeAchievements
// / activeWeeks), which is built on it. Same reason the mapper still exports
// toBeerEntry. Controllers stay the frontend's only entry point.

/** Current user's full history for the session-derived screens (stats, achievements, own profile). */
export async function getMyDrinkHistory(): Promise<BeerEntry[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return getDrinkHistory(user.id);
}

/** Another user's history for the public profile. Public read (no auth). */
export async function getDrinkHistoryForUser(
  input: GetDrinkHistoryForUserDTO
): Promise<BeerEntry[]> {
  return getDrinkHistory(input.userId);
}

/** The dashboard feed: viewer alone ("You" tab) or viewer + everyone they follow. */
export async function getMyFeed(input: GetMyFeedDTO): Promise<BeerEntry[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const userIds = input.onlyOwn
    ? [user.id]
    : [user.id, ...(await getFollowingIds(user.id))];
  return getFeedDrinkHistory(userIds);
}

/** The ±48h check-in window a session page recomputes its session from. */
export async function getSessionCheckins(
  input: GetSessionCheckinsDTO
): Promise<BeerEntry[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  return getSessionWindow(input.anchorId);
}

/** One of the current user's own check-ins (for the edit form). */
export async function getMyDrinkEntry(
  input: GetMyDrinkEntryDTO
): Promise<BeerEntry | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  return getDrinkEntryForUser(user.id, input.id);
}

/** The current user's most recent check-ins (the "Recent" list on /log). */
export async function getMyRecentDrinks(
  input: GetMyRecentDrinksDTO
): Promise<BeerEntry[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return getRecentDrinkHistory(user.id, input.limit);
}
