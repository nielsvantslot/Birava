"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FeedEntry, FollowCounts, PublicProfile } from "@/lib/types";

export async function followUser(targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: targetUserId });

  if (error) throw new Error(error.message);
  revalidatePath("/feed");
  revalidatePath("/people");
}

export async function unfollowUser(targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId);

  if (error) throw new Error(error.message);
  revalidatePath("/feed");
  revalidatePath("/people");
}

export async function getFollowCounts(
  profileId: string
): Promise<FollowCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_follow_counts", {
    profile_id: profileId,
  });
  if (error || !data || data.length === 0)
    return { followers: 0, following: 0 };
  const row = data[0];
  return {
    followers: Number(row.followers ?? 0),
    following: Number(row.following ?? 0),
  };
}

export async function getSocialFeed(
  limit = 20,
  offset = 0
): Promise<FeedEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_social_feed", {
    lim: limit,
    off: offset,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as FeedEntry[];
}

export async function searchUsers(query: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .ilike("username", `%${query}%`)
    .neq("id", user.id)
    .limit(20);

  if (error) return [];
  return data ?? [];
}

export async function getPublicProfile(
  username: string
): Promise<PublicProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_profile", {
    target_username: username,
  });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    id: row.id,
    username: row.username,
    avatar_url: row.avatar_url,
    member_since: row.member_since,
    total_beers: Number(row.total_beers ?? 0),
    streak_days: Number(row.streak_days ?? 0),
  };
}

export async function getIsFollowing(
  targetUserId: string
): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();

  return data !== null;
}

export async function getPublicRecentEntries(targetUserId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("beer_entries")
    .select("id, beer_name, brewery, style, amount, notes, created_at")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
}
