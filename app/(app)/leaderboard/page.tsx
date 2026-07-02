import { createClient, getUser } from "@/lib/supabase/server";
import { BoardGroupsClient } from "@/components/beer/board-groups-client";


export default async function LeaderboardPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const [followsResult, membershipsResult] = await Promise.all([
    supabase.from("follows").select("following_id").eq("follower_id", user.id),
    supabase
      .from("group_members")
      .select("group_id, groups(id, name, invite_code, owner_id)")
      .eq("user_id", user.id),
  ]);

  const followedIds = (followsResult.data ?? []).map((f) => f.following_id);

  const groups: Array<{
    id: string;
    name: string;
    invite_code: string;
    owner_id: string | null;
  }> = (membershipsResult.data ?? []).flatMap((m) =>
    Array.isArray(m.groups) ? m.groups : m.groups ? [m.groups] : []
  );

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-black">Board 🏆</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
          Your groups and leaderboards
        </p>
      </div>

      <BoardGroupsClient
        groups={groups}
        userId={user.id}
        hasFriends={followedIds.length > 0}
      />
    </div>
  );
}

