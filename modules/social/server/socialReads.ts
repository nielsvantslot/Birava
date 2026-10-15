import { getCurrentUser } from "@/modules/identity/server/session";
import { searchUsers as searchUsersQuery } from "@/modules/identity/server/userQueries";
import {
  getFollowCounts as getFollowCountsQuery,
  getFollowers as getFollowersQuery,
  getFollowing as getFollowingQuery,
  getFollowingIds,
  isFollowing,
} from "@/modules/social/server/followQueries";
import { getCheerStates, type CheerState } from "@/modules/social/server/cheerQueries";
import {
  getCommentCounts as getCommentCountsQuery,
  getSessionComments as getSessionCommentsQuery,
} from "@/modules/social/server/commentQueries";
import type {
  CommentDTO,
  FollowCountsDTO,
  FollowCountsQueryDTO,
  GetCommentCountsDTO,
  GetSessionCommentsDTO,
  GetSessionCheersDTO,
  IsFollowingQueryDTO,
  SearchUsersDTO,
  UserSummaryDTO,
} from "@/lib/dtos";

// Reads for pages and the GET routes (app/api/people/search). Deliberately not
// Server Actions: every export of a "use server" file is a public POST
// endpoint, and a read has no business being one.

export async function getFollowCounts(input: FollowCountsQueryDTO): Promise<FollowCountsDTO> {
  return getFollowCountsQuery(input.profileId);
}

/** Same visibility as getFollowCounts — anyone's follow counts are already public app-wide, so their list is too. */
export async function getFollowersList(input: FollowCountsQueryDTO): Promise<UserSummaryDTO[]> {
  return getFollowersQuery(input.profileId);
}

export async function getFollowingList(input: FollowCountsQueryDTO): Promise<UserSummaryDTO[]> {
  return getFollowingQuery(input.profileId);
}

export async function searchUsers(input: SearchUsersDTO): Promise<UserSummaryDTO[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return searchUsersQuery(user.id, input.query);
}

export async function getMyFollowingIds(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return getFollowingIds(user.id);
}

export async function isFollowingUser(input: IsFollowingQueryDTO): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  return isFollowing(user.id, input.targetUserId);
}

/** Cheer counts + the viewer's own state for a set of session ids. */
export async function getSessionCheers(
  input: GetSessionCheersDTO
): Promise<Map<string, CheerState>> {
  const user = await getCurrentUser();
  if (!user) return new Map();

  return getCheerStates(input.sessionIds, user.id);
}

/** Comment counts for a set of session ids — used by feed cards. */
export async function getCommentCounts(
  input: GetCommentCountsDTO
): Promise<Map<string, number>> {
  const user = await getCurrentUser();
  if (!user) return new Map();

  return getCommentCountsQuery(input.sessionIds);
}

/** Full comment threads for a set of session ids. */
export async function getSessionComments(
  input: GetSessionCommentsDTO
): Promise<Map<string, CommentDTO[]>> {
  const user = await getCurrentUser();
  if (!user) return new Map();

  return getSessionCommentsQuery(input.sessionIds);
}
