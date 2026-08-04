import { db } from "@/lib/db";
import { UserSummaryMapper } from "@/lib/mappers";
import { FollowCountsDTO, UserSummaryDTO } from "@/lib/dtos";

/** Full user rows (not just ids) of everyone following `userId`, most recent first. */
export async function getFollowers(userId: string): Promise<UserSummaryDTO[]> {
  const follows = await db.follow.findMany({
    where: { followingId: userId },
    select: { follower: { select: { id: true, username: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
  return follows.map((f) => UserSummaryMapper.toDTO(f.follower));
}

/** Full user rows (not just ids) of everyone `userId` follows, most recent first. */
export async function getFollowing(userId: string): Promise<UserSummaryDTO[]> {
  const follows = await db.follow.findMany({
    where: { followerId: userId },
    select: { following: { select: { id: true, username: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
  return follows.map((f) => UserSummaryMapper.toDTO(f.following));
}

export async function getFollowCounts(profileId: string): Promise<FollowCountsDTO> {
  const [followers, following] = await Promise.all([
    db.follow.count({ where: { followingId: profileId } }),
    db.follow.count({ where: { followerId: profileId } }),
  ]);
  return { followers, following };
}

export async function getFollowingIds(userId: string): Promise<string[]> {
  const follows = await db.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  return follows.map((f) => f.followingId);
}

/** Ids of users who follow `userId` (the inverse of getFollowingIds). */
export async function getFollowerIds(userId: string): Promise<string[]> {
  const follows = await db.follow.findMany({
    where: { followingId: userId },
    select: { followerId: true },
  });
  return follows.map((f) => f.followerId);
}

export async function isFollowing(followerId: string, targetUserId: string): Promise<boolean> {
  const follow = await db.follow.findUnique({
    where: {
      followerId_followingId: { followerId, followingId: targetUserId },
    },
  });
  return follow !== null;
}
