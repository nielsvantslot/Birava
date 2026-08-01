import { db } from "@/lib/db";
import { getFollowingIds, getFollowerIds } from "@/lib/queries/followQueries";

export type CrewInviteCandidate = {
  userId: string;
  username: string;
  avatarUrl: string | null;
};

/**
 * Who `actorId` can invite into `groupId` right now: mutual follows only,
 * minus existing members and anyone with an already-pending invite. Returns
 * null if the actor can't invite at all (not a member, or a plain member of
 * a private crew — only the owner/admins can invite there).
 */
export async function getCrewInviteCandidates(
  actorId: string,
  groupId: string
): Promise<{ candidates: CrewInviteCandidate[]; pending: CrewInviteCandidate[] } | null> {
  const group = await db.group.findUnique({
    where: { id: groupId },
    include: { members: { select: { userId: true, role: true } } },
  });
  if (!group) return null;

  const actorMembership = group.members.find((m) => m.userId === actorId);
  if (!actorMembership) return null;
  if (group.visibility === "PRIVATE" && actorMembership.role === "MEMBER") return null;

  const [followingIds, followerIds, pendingInvites] = await Promise.all([
    getFollowingIds(actorId),
    getFollowerIds(actorId),
    db.groupInvite.findMany({
      where: { groupId, status: "PENDING" },
      select: { invitedUserId: true, invitedUser: { select: { username: true, avatarUrl: true } } },
    }),
  ]);

  const followerSet = new Set(followerIds);
  const mutualIds = followingIds.filter((id) => followerSet.has(id));
  const memberIds = new Set(group.members.map((m) => m.userId));
  const pendingSet = new Set(pendingInvites.map((i) => i.invitedUserId));

  const invitableIds = mutualIds.filter((id) => !memberIds.has(id) && !pendingSet.has(id));
  const users =
    invitableIds.length === 0
      ? []
      : await db.user.findMany({
          where: { id: { in: invitableIds } },
          select: { id: true, username: true, avatarUrl: true },
        });

  return {
    candidates: users.map((u) => ({ userId: u.id, username: u.username, avatarUrl: u.avatarUrl })),
    pending: pendingInvites.map((i) => ({
      userId: i.invitedUserId,
      username: i.invitedUser.username,
      avatarUrl: i.invitedUser.avatarUrl,
    })),
  };
}
