import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buildLeaderboard } from "@/lib/leaderboard";
import { LeaderboardClient } from "@/components/beer/leaderboard-client";
import { GroupLeaderboardClient } from "@/components/beer/group-leaderboard-client";
import { FeedEntry } from "@/lib/types";
import { GroupMediaGallery } from "@/components/beer/group-media-gallery";


export default async function GroupLeaderboardPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const isFriends = groupId === "friends";

  if (isFriends) {
    // Friends leaderboard: current user + people they follow
    const { data: followsData } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);

    const followedIds = (followsData ?? []).map((f) => f.following_id);
    const friendIds = [...new Set([user.id, ...followedIds])];

    const { data: entries } = await supabase
      .from("beer_entries")
      .select("user_id, amount, created_at, profiles(username, avatar_url)")
      .in("user_id", friendIds);

    const leaderboard = buildLeaderboard(entries ?? []);

    return (
      <div className="space-y-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/leaderboard"
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black">👥 Friends</h1>
            <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
              People you follow
            </p>
          </div>
        </div>

        <LeaderboardClient
          tabs={[{ id: "friends", label: "Friends", entries: leaderboard }]}
          currentUserId={user.id}
        />
      </div>
    );
  }

  // Group leaderboard
  const { data: membershipData } = await supabase
    .from("group_members")
    .select("groups(id, name, invite_code, owner_id)")
    .eq("user_id", user.id)
    .eq("group_id", groupId)
    .single();

  const group =
    membershipData?.groups
      ? Array.isArray(membershipData.groups)
        ? membershipData.groups[0]
        : membershipData.groups
      : null;

  if (!group) notFound();

  // Fetch all members of this group
  const { data: allMembers } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);

  const memberIds = (allMembers ?? []).map((m) => m.user_id);

  const [entriesResult, feedResult] = await Promise.all([
    supabase
      .from("beer_entries")
      .select("user_id, amount, created_at, profiles(username, avatar_url)")
      .in("user_id", memberIds.length > 0 ? memberIds : [user.id]),
    supabase.rpc("get_group_feed", { target_group_id: groupId, lim: 20, off: 0 }),
  ]);

  const leaderboard = buildLeaderboard(entriesResult.data ?? []);
  const activityFeed: FeedEntry[] = (feedResult.data ?? []) as FeedEntry[];

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center gap-3">
        <Link
          href="/leaderboard"
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black">{group.name}</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
            Group leaderboard
          </p>
        </div>
      </div>

      <GroupLeaderboardClient group={group} currentUserId={user.id} />

      <LeaderboardClient
        tabs={[{ id: groupId, label: group.name, entries: leaderboard }]}
        currentUserId={user.id}
      />

      {activityFeed.length > 0 && (
        <GroupMediaGallery entries={activityFeed} />
      )}
    </div>
  );
}
