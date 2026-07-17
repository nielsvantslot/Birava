import { db } from "@/lib/db";
import { FollowUserDTO, UnfollowUserDTO } from "@/lib/dtos";
import { queueNotifications } from "@/lib/notify";

export async function followUser(
  followerId: string,
  input: FollowUserDTO,
  actor: { username: string; avatarUrl: string | null }
): Promise<void> {
  try {
    await db.follow.create({
      data: { followerId, followingId: input.targetUserId },
    });
  } catch {
    throw new Error("Failed to follow user");
  }

  queueNotifications([
    {
      userId: input.targetUserId,
      type: "FOLLOW",
      actorId: followerId,
      actorUsername: actor.username,
      actorAvatarUrl: actor.avatarUrl,
    },
  ]);
}

export async function unfollowUser(followerId: string, input: UnfollowUserDTO): Promise<void> {
  await db.follow.deleteMany({
    where: { followerId, followingId: input.targetUserId },
  });
}
