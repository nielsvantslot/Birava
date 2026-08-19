import { db } from "@/lib/db";
import { getFollowingIds, getFollowerIds } from "@/lib/queries/followQueries";

export type CrewInviteCandidate = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isDeveloper: boolean;
};

const CANDIDATES_PAGE_SIZE = 20;

/**
 * Who `actorId` can invite into `groupId` right now: mutual follows only,
 * minus existing members and anyone with an already-pending invite. Returns
 * null if the actor can't invite at all (not a member, or a plain member of
 * a private crew — only the owner/admins can invite there).
 *
 * `candidates` is search+paginated server-side (a mutual-follow list can run
 * into the hundreds) — `pending` isn't, since it's bounded by how many
 * invites this crew has actually sent, not by the actor's follow graph.
 */
export async function getCrewInviteCandidates(
  actorId: string,
  groupId: string,
  options: { search?: string; offset?: number } = {}
): Promise<{ candidates: CrewInviteCandidate[]; total: number; pending: CrewInviteCandidate[] } | null> {
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
      select: {
        invitedUserId: true,
        invitedUser: { select: { username: true, avatarUrl: true, isDeveloper: true } },
      },
    }),
  ]);

  const followerSet = new Set(followerIds);
  const mutualIds = followingIds.filter((id) => followerSet.has(id));
  const memberIds = new Set(group.members.map((m) => m.userId));
  const pendingSet = new Set(pendingInvites.map((i) => i.invitedUserId));

  const invitableIds = mutualIds.filter((id) => !memberIds.has(id) && !pendingSet.has(id));
  const search = options.search?.trim();
  const where = {
    id: { in: invitableIds },
    ...(search ? { username: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [users, total] =
    invitableIds.length === 0
      ? [[], 0]
      : await Promise.all([
          db.user.findMany({
            where,
            select: { id: true, username: true, avatarUrl: true, isDeveloper: true },
            orderBy: { username: "asc" },
            take: CANDIDATES_PAGE_SIZE,
            skip: options.offset ?? 0,
          }),
          db.user.count({ where }),
        ]);

  return {
    candidates: users.map((u) => ({
      userId: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      isDeveloper: u.isDeveloper,
    })),
    total,
    pending: pendingInvites.map((i) => ({
      userId: i.invitedUserId,
      username: i.invitedUser.username,
      avatarUrl: i.invitedUser.avatarUrl,
      isDeveloper: i.invitedUser.isDeveloper,
    })),
  };
}
