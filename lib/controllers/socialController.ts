"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { throwNotAuthenticated } from "@/lib/auth/authErrors";
import {
  followUser as followUserCommand,
  unfollowUser as unfollowUserCommand,
} from "@/lib/commands/followCommands";
import { toggleProost as toggleProostCommand } from "@/lib/commands/proostCommands";
import { getFollowCounts as getFollowCountsQuery, getFollowingIds, isFollowing } from "@/lib/queries/followQueries";
import { getSocialFeed as getSocialFeedQuery } from "@/lib/queries/drinkEntryQueries";
import { searchUsers as searchUsersQuery } from "@/lib/queries/userQueries";
import {
  getProostStates,
  type ProostState,
} from "@/lib/queries/proostQueries";
import {
  DrinkEntryWithAuthorDTO,
  FollowCountsDTO,
  FollowCountsQueryDTO,
  FollowUserDTO,
  GetSessionProostsDTO,
  GetSocialFeedDTO,
  IsFollowingQueryDTO,
  SearchUsersDTO,
  ToggleProostDTO,
  ToggleProostResultDTO,
  UnfollowUserDTO,
  UserSummaryDTO,
} from "@/lib/dtos";

export async function followUser(input: FollowUserDTO): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throwNotAuthenticated();

  await followUserCommand(user.id, input, {
    username: user.username,
    avatarUrl: user.avatarUrl,
  });

  revalidatePath("/dashboard");
  revalidatePath("/people");
  // F9: the follower/following counts render on the public profile — refresh
  // it too, which the old path list missed.
  revalidatePath("/profile/[username]", "page");
  revalidatePath("/profile");
}

export async function unfollowUser(input: UnfollowUserDTO): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throwNotAuthenticated();

  await unfollowUserCommand(user.id, input);

  revalidatePath("/dashboard");
  revalidatePath("/people");
  revalidatePath("/profile/[username]", "page");
  revalidatePath("/profile");
}

export async function getFollowCounts(input: FollowCountsQueryDTO): Promise<FollowCountsDTO> {
  return getFollowCountsQuery(input.profileId);
}

export async function getSocialFeed(
  input: GetSocialFeedDTO = {}
): Promise<DrinkEntryWithAuthorDTO[]> {
  const user = await getCurrentUser();
  if (!user) throwNotAuthenticated();

  return getSocialFeedQuery(user.id, {
    limit: input.limit ?? 20,
    offset: input.offset ?? 0,
  });
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

export async function toggleProost(input: ToggleProostDTO): Promise<ToggleProostResultDTO> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const result = await toggleProostCommand(user.id, input.entryId, {
    username: user.username,
    avatarUrl: user.avatarUrl,
  });
  if (!result.error) {
    revalidatePath("/dashboard");
    revalidatePath("/sessions", "layout");
  }
  return result;
}

/** Proost counts + the viewer's own state for a set of session anchor ids. */
export async function getSessionProosts(
  input: GetSessionProostsDTO
): Promise<Map<string, ProostState>> {
  const user = await getCurrentUser();
  if (!user) return new Map();

  return getProostStates(input.entryIds, user.id);
}
