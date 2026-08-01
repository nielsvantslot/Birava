import { db } from "@/lib/db";
import {
  scoreCrew,
  getCrewBoard,
  type CrewMemberInput,
  type CrewMemberScore,
} from "@/lib/crews";
import type { DrinkSession } from "@/lib/sessions";

const memberSelect = {
  select: {
    userId: true,
    role: true,
    joinedAt: true,
    user: { select: { username: true, avatarUrl: true } },
  },
} as const;

function toMemberInputs(
  members: {
    userId: string;
    joinedAt: Date;
    user: { username: string; avatarUrl: string | null };
  }[]
): CrewMemberInput[] {
  return members.map((gm) => ({
    userId: gm.userId,
    username: gm.user.username,
    avatarUrl: gm.user.avatarUrl,
    joinedAt: gm.joinedAt,
  }));
}

export type CrewSummary = {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  rank: number | null;
  closed: boolean;
};

/**
 * All of a user's crews with their rank in each. De-N+1: every crew member's
 * since-join check-ins are loaded in ONE query and scored in memory, instead
 * of a query per crew.
 */
export async function getCrewSummariesForUser(
  userId: string
): Promise<CrewSummary[]> {
  const memberships = await db.groupMember.findMany({
    where: { userId },
    include: { group: { include: { members: memberSelect } } },
    orderBy: { joinedAt: "desc" },
  });

  const allMembers = memberships.flatMap((m) => m.group.members);
  const allMemberIds = [...new Set(allMembers.map((gm) => gm.userId))];
  const rows =
    allMemberIds.length === 0
      ? []
      : await db.drinkEntry.findMany({
          where: {
            userId: { in: allMemberIds },
            createdAt: {
              gte: new Date(
                Math.min(...allMembers.map((gm) => gm.joinedAt.getTime()))
              ),
            },
          },
          orderBy: { createdAt: "asc" },
        });

  return memberships.map((m) => {
    const { scores } = scoreCrew(toMemberInputs(m.group.members), rows, m.group.closedAt);
    const rank = 1 + scores.findIndex((s) => s.userId === userId);
    return {
      id: m.group.id,
      name: m.group.name,
      inviteCode: m.group.inviteCode,
      memberCount: m.group.members.length,
      rank: rank > 0 ? rank : null,
      closed: !!m.group.closedAt,
    };
  });
}

export type CrewRole = "OWNER" | "ADMIN" | "MEMBER";

export type CrewMemberInfo = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: CrewRole;
};

export type BannedCrewMember = {
  userId: string;
  username: string;
  avatarUrl: string | null;
};

export type CrewDetail = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string; // ISO
  closedAt: string | null; // ISO
  ownerId: string;
  visibility: "PUBLIC" | "PRIVATE";
  /** The viewer's own role in this crew — drives which settings/actions they see. */
  viewerRole: CrewRole;
  memberCount: number;
  members: CrewMemberInfo[];
  bannedMembers: BannedCrewMember[];
  scores: CrewMemberScore[];
  recentSessions: DrinkSession[];
};

/** A crew's board for a viewer who must be a member — otherwise null (→ 404). */
export async function getCrewDetailForViewer(
  crewId: string,
  viewerId: string
): Promise<CrewDetail | null> {
  const crew = await db.group.findUnique({
    where: { id: crewId },
    include: { members: memberSelect },
  });
  if (!crew) return null;
  const viewer = crew.members.find((m) => m.userId === viewerId);
  if (!viewer) return null;

  const [{ scores, recentSessions }, bans] = await Promise.all([
    getCrewBoard(toMemberInputs(crew.members), crew.closedAt),
    db.groupBan.findMany({
      where: { groupId: crewId },
      include: { user: { select: { username: true, avatarUrl: true } } },
    }),
  ]);

  return {
    id: crew.id,
    name: crew.name,
    inviteCode: crew.inviteCode,
    createdAt: crew.createdAt.toISOString(),
    closedAt: crew.closedAt ? crew.closedAt.toISOString() : null,
    ownerId: crew.ownerId,
    visibility: crew.visibility,
    viewerRole: viewer.role,
    memberCount: crew.members.length,
    members: crew.members.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
    })),
    bannedMembers: bans.map((b) => ({
      userId: b.userId,
      username: b.user.username,
      avatarUrl: b.user.avatarUrl,
    })),
    scores,
    recentSessions,
  };
}
