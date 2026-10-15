import { getCurrentUser } from "@/modules/identity/server/session";
import {
  getDrinkHistory,
  getDrinkEntryForUser,
  getRecentDrinkHistory,
  getRecentDrinkHistoryForLegend,
} from "@/modules/checkins/server/drinkEntryQueries";
import { getSessionById, getSessionsForUserIds } from "@/modules/sessions/server/drinkSessionQueries";
import { getCheerStates, type CheerState } from "@/modules/social/server/cheerQueries";
import { getCommentCounts } from "@/modules/social/server/commentQueries";
import { getFollowingIds } from "@/modules/social/server/followQueries";
import type { DrinkEntry } from "@/lib/types";
import type { DrinkSession } from "@/modules/sessions/domain/sessions";
import type {
  GetDrinkHistoryForUserDTO,
  GetMyDrinkEntryDTO,
  GetMyFeedDTO,
  GetMyRecentDrinksDTO,
  GetSessionDTO,
  GetSessionsForUserDTO,
} from "@/lib/dtos";

// Reads for pages and the GET routes (app/api/feed, app/api/drink-suggestions).
// Deliberately not Server Actions: every export of a "use server" file is a
// public POST endpoint, and a read has no business being one. They return the
// legacy `DrinkEntry` shape (not DrinkEntryDTO) because they feed the session
// engine (groupIntoSessions / computeAchievements / activeWeeks), which is
// built on it. Same reason the mapper still exports toDrinkEntry.

/** Feed sessions fetched per page — matches the dashboard's current page size. */
const FEED_SESSION_LIMIT = 12;

/** Current user's full history for the session-derived screens (stats, achievements, own profile). */
export async function getMyDrinkHistory(): Promise<DrinkEntry[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return getDrinkHistory(user.id);
}

/** Current user's last 90 days of check-ins, for the dashboard's Local Legend stat — see getRecentDrinkHistoryForLegend. */
export async function getMyRecentDrinkHistoryForLegend(): Promise<Array<Pick<DrinkEntry, "venue" | "created_at">>> {
  const user = await getCurrentUser();
  if (!user) return [];

  return getRecentDrinkHistoryForLegend(user.id);
}

/** Another user's history for the public profile. Public read (no auth). */
export async function getDrinkHistoryForUser(
  input: GetDrinkHistoryForUserDTO
): Promise<DrinkEntry[]> {
  return getDrinkHistory(input.userId);
}

/** A single session by id — the session detail page. */
export async function getSession(input: GetSessionDTO): Promise<DrinkSession | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  return getSessionById(input.id);
}

/** One page of the dashboard feed: sessions plus everything a SessionCard needs to render them. */
export type FeedSessionsPage = {
  sessions: DrinkSession[];
  cheers: [string, CheerState][];
  commentCounts: [string, number][];
  /** Pass straight back as beforeEndedAt/beforeId to fetch the next page; null when there isn't one. */
  nextCursor: { endedAt: string; id: string } | null;
};

const EMPTY_FEED_PAGE: FeedSessionsPage = { sessions: [], cheers: [], commentCounts: [], nextCursor: null };

/**
 * One page of the dashboard feed's sessions: viewer alone ("You" tab) or
 * viewer + everyone they follow, newest-ended first. Called both for the
 * initial (server-rendered) page and, through GET /api/feed, by the client's
 * infinite-scroll "load more" — same function, same shape, so there's
 * exactly one way this data gets assembled.
 *
 * Fetches one extra row over the page size to know whether a next page
 * exists, rather than a separate count query.
 */
export async function getMyFeedSessions(input: GetMyFeedDTO): Promise<FeedSessionsPage> {
  const user = await getCurrentUser();
  if (!user) return EMPTY_FEED_PAGE;

  const userIds = input.onlyOwn
    ? [user.id]
    : [user.id, ...(await getFollowingIds(user.id))];
  const before =
    input.beforeEndedAt && input.beforeId
      ? { endedAt: new Date(input.beforeEndedAt), id: input.beforeId }
      : undefined;

  const rows = await getSessionsForUserIds(userIds, { limit: FEED_SESSION_LIMIT + 1, before });
  const hasMore = rows.length > FEED_SESSION_LIMIT;
  const sessions = hasMore ? rows.slice(0, FEED_SESSION_LIMIT) : rows;
  const sessionIds = sessions.map((s) => s.id);

  const [cheerMap, commentCountMap] = await Promise.all([
    getCheerStates(sessionIds, user.id),
    getCommentCounts(sessionIds),
  ]);

  const last = sessions[sessions.length - 1];
  return {
    sessions,
    cheers: [...cheerMap.entries()],
    commentCounts: [...commentCountMap.entries()],
    nextCursor: hasMore && last ? { endedAt: last.end, id: last.id } : null,
  };
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

export type DrinkSuggestionsDTO = { names: string[]; venues: string[] };

const SUGGESTION_SAMPLE_SIZE = 30;
const MAX_SUGGESTIONS = 8;

function distinctRecentValues(values: (string | null)[]): string[] {
  // `values` comes in most-recent-first, so a plain Set (insertion order)
  // keeps each value's most recent occurrence without a separate sort.
  return [...new Set(values.map((v) => v?.trim()).filter((v): v is string => !!v))].slice(0, MAX_SUGGESTIONS);
}

/**
 * Distinct recent drink names/venues for the log form's autocomplete
 * (datalist) — lets a habitual drink/venue be picked instead of retyped.
 * Fetched client-side after the form itself has already rendered (see
 * log-drink-form.tsx), same "silent enrichment, never blocks" pattern as
 * geolocation.
 */
export async function getMyDrinkSuggestions(): Promise<DrinkSuggestionsDTO> {
  const user = await getCurrentUser();
  if (!user) return { names: [], venues: [] };

  const recent = await getRecentDrinkHistory(user.id, SUGGESTION_SAMPLE_SIZE);
  return {
    names: distinctRecentValues(recent.map((e) => e.drink_name)),
    venues: distinctRecentValues(recent.map((e) => e.venue)),
  };
}
