import { db } from "@/lib/db";
import { FollowCountsDTO } from "@/lib/dtos";

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

export async function isFollowing(followerId: string, targetUserId: string): Promise<boolean> {
  const follow = await db.follow.findUnique({
    where: {
      followerId_followingId: { followerId, followingId: targetUserId },
    },
  });
  return follow !== null;
}
