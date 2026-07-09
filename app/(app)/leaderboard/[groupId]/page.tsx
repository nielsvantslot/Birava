import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { toFeedEntry } from "@/lib/mappers";
import { buildLeaderboard } from "@/lib/leaderboard";
import { LeaderboardClient } from "@/components/beer/leaderboard-client";
import { GroupLeaderboardClient } from "@/components/beer/group-leaderboard-client";
import { FeedEntry } from "@/lib/types";
import { GroupMediaGallery } from "@/components/beer/group-media-gallery";

function toLeaderboardInput(entry: {
  userId: string;
  amount: unknown;
  createdAt: Date;
  user: { username: string; avatarUrl: string | null };
}) {
  return {
    user_id: entry.userId,
    amount: Number(entry.amount),
    created_at: entry.createdAt.toISOString(),
    profiles: {
      username: entry.user.username,
      avatar_url: entry.user.avatarUrl,
    },
  };
}

export default async function GroupLeaderboardPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const isFriends = groupId === "friends";

  if (isFriends) {
    // Friends leaderboard: current user + people they follow
    const follows = await db.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });

    const followedIds = follows.map((f) => f.followingId);
    const friendIds = [...new Set([user.id, ...followedIds])];

    const entries = await db.beerEntry.findMany({
      where: { userId: { in: friendIds } },
      include: { user: { select: { username: true, avatarUrl: true } } },
    });

    const leaderboard = buildLeaderboard(entries.map(toLeaderboardInput));

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
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
    include: { group: true },
  });

  const group = membership
    ? {
        id: membership.group.id,
        name: membership.group.name,
        invite_code: membership.group.inviteCode,
        owner_id: membership.group.ownerId,
      }
    : null;

  if (!group) notFound();

  // Fetch all members of this group
  const allMembers = await db.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });

  const memberIds = allMembers.map((m) => m.userId);

  const targetMemberIds = memberIds.length > 0 ? memberIds : [user.id];

  const [entries, photos] = await Promise.all([
    db.beerEntry.findMany({
      where: { userId: { in: targetMemberIds } },
      include: { user: { select: { username: true, avatarUrl: true } } },
    }),
    db.beerEntry.findMany({
      where: { userId: { in: targetMemberIds }, photoUrl: { not: null } },
      include: { user: { select: { username: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const leaderboard = buildLeaderboard(entries.map(toLeaderboardInput));
  const galleryEntries: FeedEntry[] = photos.map(toFeedEntry);

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

      <GroupMediaGallery entries={galleryEntries} />
    </div>
  );
}
