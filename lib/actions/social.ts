"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { toFeedEntry } from "@/lib/mappers";
import { FeedEntry, FollowCounts, PublicProfile } from "@/lib/types";

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

  revalidatePath("/feed");
  revalidatePath("/people");
}

export async function unfollowUser(targetUserId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  await db.follow.deleteMany({
    where: { followerId: user.id, followingId: targetUserId },
  });

  revalidatePath("/feed");
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

export async function getSocialFeed(
  limit = 20,
  offset = 0
): Promise<FeedEntry[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const following = await db.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  });
  const ids = following.map((f) => f.followingId);
  if (ids.length === 0) return [];

  const entries = await db.beerEntry.findMany({
    where: { userId: { in: ids } },
    include: { user: { select: { username: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
  });

  return entries.map(toFeedEntry);
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

export async function getPublicProfile(
  username: string
): Promise<PublicProfile | null> {
  const user = await db.user.findUnique({ where: { username } });
  if (!user) return null;

  const total = await db.beerEntry.aggregate({
    where: { userId: user.id },
    _sum: { amount: true },
  });

  return {
    id: user.id,
    username: user.username,
    avatar_url: user.avatarUrl,
    member_since: user.createdAt.toISOString(),
    total_beers: Number(total._sum.amount ?? 0),
    streak_days: 0,
  };
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

export async function getPublicRecentEntries(targetUserId: string) {
  const entries = await db.beerEntry.findMany({
    where: { userId: targetUserId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return entries.map((e) => ({
    id: e.id,
    beer_name: e.beerName,
    brewery: e.brewery,
    style: e.style,
    amount: Number(e.amount),
    notes: e.notes,
    created_at: e.createdAt.toISOString(),
  }));
}
