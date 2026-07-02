import { createClient } from "@/lib/supabase/server";
import { LeaderboardEntry } from "@/lib/types";
import { LeaderboardClient, LeaderboardTab } from "@/components/beer/leaderboard-client";
import { GroupsClient } from "@/components/beer/groups-client";

export const dynamic = "force-dynamic";

function buildLeaderboard(
  entries: Array<{
    user_id: string;
    amount: number;
    created_at: string;
    profiles:
      | { username: string; avatar_url: string | null }
      | { username: string; avatar_url: string | null }[]
      | null;
  }>
): LeaderboardEntry[] {
  const today = new Date();
  const perUser: Record<string, LeaderboardEntry> = {};
  const daysByUser: Record<string, Set<string>> = {};

  for (const e of entries) {
    const uid = e.user_id;
    const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
    if (!perUser[uid]) {
      perUser[uid] = {
        user_id: uid,
        username: profile?.username ?? "Unknown",
        avatar_url: profile?.avatar_url ?? null,
        total: 0,
        today: 0,
        avg_per_day: 0,
      };
      daysByUser[uid] = new Set();
    }
    perUser[uid].total += e.amount;
    const d = new Date(e.created_at);
    daysByUser[uid].add(d.toLocaleDateString());
    if (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    ) {
      perUser[uid].today += e.amount;
    }
  }

  for (const uid in perUser) {
    const days = daysByUser[uid];
    perUser[uid].avg_per_day =
      days.size > 0
        ? Math.round((perUser[uid].total / days.size) * 10) / 10
        : 0;
  }

  return Object.values(perUser).sort((a, b) => b.total - a.total);
}

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch follows, groups and current user's profile in parallel
  const [followsResult, membershipsResult] = await Promise.all([
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id),
    supabase
      .from("group_members")
      .select("group_id, groups(id, name, invite_code, owner_id)")
      .eq("user_id", user.id),
  ]);

  const followedIds = (followsResult.data ?? []).map((f) => f.following_id);
  const friendIds = [...new Set([user.id, ...followedIds])];

  const groups: Array<{
    id: string;
    name: string;
    invite_code: string;
    owner_id: string | null;
  }> =
    (membershipsResult.data ?? []).flatMap((m) =>
      Array.isArray(m.groups) ? m.groups : m.groups ? [m.groups] : []
    );

  // Collect all group member IDs
  const groupMembersMap: Record<string, string[]> = {};
  if (groups.length > 0) {
    const groupIds = groups.map((g) => g.id);
    const { data: allMembers } = await supabase
      .from("group_members")
      .select("group_id, user_id")
      .in("group_id", groupIds);

    for (const m of allMembers ?? []) {
      if (!groupMembersMap[m.group_id]) groupMembersMap[m.group_id] = [];
      groupMembersMap[m.group_id].push(m.user_id);
    }
  }

  // Collect all user IDs we need entries for
  const allGroupMemberIds = Object.values(groupMembersMap).flat();
  const allUserIds = [...new Set([...friendIds, ...allGroupMemberIds])];

  // Fetch all beer entries for all relevant users in one query
  const { data: allEntries } = await supabase
    .from("beer_entries")
    .select("user_id, amount, created_at, profiles(username, avatar_url)")
    .in("user_id", allUserIds);

  const entries = allEntries ?? [];
  const entriesByUserId = entries.reduce<
    Record<string, typeof entries>
  >((accumulator, entry) => {
    if (!accumulator[entry.user_id]) {
      accumulator[entry.user_id] = [];
    }

    accumulator[entry.user_id].push(entry);
    return accumulator;
  }, {});

  // Build tabs
  const tabs: LeaderboardTab[] = [];

  // Friends tab (current user + people they follow)
  const friendEntries = friendIds.flatMap((friendId) => entriesByUserId[friendId] ?? []);
  if (friendEntries.length > 0 || followedIds.length > 0) {
    tabs.push({
      id: "friends",
      label: "👥 Friends",
      entries: buildLeaderboard(friendEntries),
    });
  }

  // One tab per group
  for (const group of groups) {
    const memberIds = groupMembersMap[group.id] ?? [];
    const groupEntries = memberIds.flatMap((memberId) => entriesByUserId[memberId] ?? []);
    tabs.push({
      id: group.id,
      label: group.name,
      entries: buildLeaderboard(groupEntries),
    });
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-black">Leaderboard 🏆</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
          Holiday beer rankings and group management
        </p>
      </div>

      <LeaderboardClient tabs={tabs} currentUserId={user.id} />

      <div className="space-y-6 pt-2">
        <div>
          <h2 className="text-xl font-black">Groups 👥</h2>
          <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
            Create or join groups from the board
          </p>
        </div>

        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="text-6xl mb-4">👥</span>
            <p className="font-semibold text-lg">No groups yet</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Create a group or join one with an invite code.
            </p>
          </div>
        )}

        <GroupsClient groups={groups} userId={user.id} />
      </div>
    </div>
  );
}
