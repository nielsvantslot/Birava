import { db } from "@/lib/db";
import { FollowUserDTO, UnfollowUserDTO } from "@/lib/dtos";

export async function followUser(followerId: string, input: FollowUserDTO): Promise<void> {
  try {
    await db.follow.create({
      data: { followerId, followingId: input.targetUserId },
    });
  } catch {
    throw new Error("Failed to follow user");
  }
}

export async function unfollowUser(followerId: string, input: UnfollowUserDTO): Promise<void> {
  await db.follow.deleteMany({
    where: { followerId, followingId: input.targetUserId },
  });
}
