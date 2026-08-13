import { db } from "@/lib/db";
import {
  scoreCrew,
  type CrewMemberInput,
  type CrewMemberScore,
} from "@/lib/crews";
import { getSessionsForUserIds } from "@/lib/queries/drinkSessionQueries";
import { VENUE_SELECT } from "@/lib/queries/venueSelect";
import type { DrinkSession } from "@/lib/sessions";

/**
 * Just the ids of the crews a user belongs to — for scoping revalidation to
 * only that user's own crews (see drinkController.ts's revalidateDrinkPaths),
 * not for display, so it skips the member/score joins getCrewSummariesForUser
 * needs.
 */
export async function getGroupIdsForUser(userId: string): Promise<string[]> {
  const memberships = await db.groupMember.findMany({ where: { userId }, select: { groupId: true } });
  return memberships.map((m) => m.groupId);
}

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
          include: { venue: VENUE_SELECT },
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

/**
 * The board's "recent sessions" — real, DB-backed DrinkSession rows, not
 * groupIntoSessions()'s in-memory recomputation. A session's id is
 * permanent from creation and can drift from what that recomputation would
 * derive after a backdated check-in triggers a merge/split (CLAUDE.md's
 * locked session-id invariant) — this page links to `/sessions/[id]`, so it
 * must go through the stored id, unlike scoreCrew()'s own `recentSessions`
 * (aggregate-only, never exposed as a link, still fine to compute in-memory
 * for pure/tested scoring).
 *
 * Overfetches past the eventual 4-item slice since some fetched sessions
 * won't overlap a given member's crew window and get filtered out below.
 */
async function getRecentCrewSessions(
  members: CrewMemberInput[],
  closedAt: Date | null
): Promise<DrinkSession[]> {
  const joinedAt = new Map(members.map((m) => [m.userId, m.joinedAt]));
  const cutoff = closedAt ?? new Date();

  const sessions = await getSessionsForUserIds(members.map((m) => m.userId), { limit: 20 });
  return sessions
    .filter((s) => {
      const joined = joinedAt.get(s.userId);
      return joined !== undefined && new Date(s.start) <= cutoff && new Date(s.end) >= joined;
    })
    .slice(0, 4);
}

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

  const members = toMemberInputs(crew.members);
  const earliest = new Date(Math.min(...members.map((m) => m.joinedAt.getTime())));
  const [entryRows, recentSessions, bans] = await Promise.all([
    db.drinkEntry.findMany({
      where: {
        userId: { in: members.map((m) => m.userId) },
        createdAt: { gte: earliest, ...(crew.closedAt ? { lte: crew.closedAt } : {}) },
      },
      orderBy: { createdAt: "asc" },
      include: { venue: VENUE_SELECT },
    }),
    getRecentCrewSessions(members, crew.closedAt),
    db.groupBan.findMany({
      where: { groupId: crewId },
      include: { user: { select: { username: true, avatarUrl: true } } },
    }),
  ]);
  const { scores } = scoreCrew(members, entryRows, crew.closedAt);

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
