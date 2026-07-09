"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { FollowCounts } from "@/lib/types";

/**
 * Toggle a proost on a session (keyed by its anchor check-in id).
 * Returns the new state so the button can settle without a refetch.
 */
export async function toggleProost(
  entryId: string
): Promise<{ on: boolean; count: number } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const key = { entryId_userId: { entryId, userId: user.id } };
  const existing = await db.proost.findUnique({ where: key });

  try {
    if (existing) {
      await db.proost.delete({ where: key });
    } else {
      await db.proost.create({ data: { entryId, userId: user.id } });
    }
  } catch {
    return { error: "Failed to proost" };
  }

  const count = await db.proost.count({ where: { entryId } });
  revalidatePath("/dashboard");
  revalidatePath("/sessions", "layout");
  return { on: !existing, count };
}

export async function followUser(targetUserId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  try {
    await db.follow.create({
      data: { followerId: user.id, followingId: targetUserId },
    });
  } catch {
    throw new Error("Failed to follow user");
  }

  revalidatePath("/dashboard");
  revalidatePath("/people");
}

export async function unfollowUser(targetUserId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  await db.follow.deleteMany({
    where: { followerId: user.id, followingId: targetUserId },
  });

  revalidatePath("/dashboard");
  revalidatePath("/people");
}

export async function getFollowCounts(
  profileId: string
): Promise<FollowCounts> {
  const [followers, following] = await Promise.all([
    db.follow.count({ where: { followingId: profileId } }),
    db.follow.count({ where: { followerId: profileId } }),
  ]);
  return { followers, following };
}

export async function searchUsers(query: string) {
  const user = await getCurrentUser();
  if (!user) return [];

  const users = await db.user.findMany({
    where: {
      username: { contains: query.trim(), mode: "insensitive" },
      id: { not: user.id },
    },
    select: { id: true, username: true, avatarUrl: true },
    take: 20,
  });

  return users.map((u) => ({
    id: u.id,
    username: u.username,
    avatar_url: u.avatarUrl,
  }));
}

export async function getIsFollowing(
  targetUserId: string
): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const follow = await db.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: user.id,
        followingId: targetUserId,
      },
    },
  });

  return follow !== null;
}
