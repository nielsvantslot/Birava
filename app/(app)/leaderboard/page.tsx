import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { BoardGroupsClient } from "@/components/beer/board-groups-client";


export default async function LeaderboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [follows, memberships] = await Promise.all([
    db.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    }),
    db.groupMember.findMany({
      where: { userId: user.id },
      include: { group: true },
    }),
  ]);

  const followedIds = follows.map((f) => f.followingId);

  const groups: Array<{
    id: string;
    name: string;
    invite_code: string;
    owner_id: string | null;
  }> = memberships.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    invite_code: m.group.inviteCode,
    owner_id: m.group.ownerId,
  }));

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

