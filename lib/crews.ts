import { db } from "@/lib/db";
import { toBeerEntry } from "@/lib/mappers";
import { DrinkSession, groupIntoSessions } from "@/lib/sessions";

/**
 * Crew scoring: everyone is ranked from the day they joined — never
 * lifetime totals, so joining a crew with history doesn't auto-win it.
 * Metrics are sessions and venues (variety), never drink counts.
 */
export type CrewMemberScore = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  joinedAt: string; // ISO
  sessions: number;
  venues: number;
};

export type CrewBoard = {
  scores: CrewMemberScore[]; // sorted by sessions desc
  recentSessions: DrinkSession[]; // newest first, since each member joined
};

export async function getCrewBoard(groupId: string): Promise<CrewBoard> {
  const members = await db.groupMember.findMany({
    where: { groupId },
    include: {
      user: { select: { id: true, username: true, avatarUrl: true } },
    },
  });
  if (members.length === 0) return { scores: [], recentSessions: [] };

  const earliest = new Date(
    Math.min(...members.map((m) => m.joinedAt.getTime()))
  );
  const rows = await db.drinkEntry.findMany({
    where: {
      userId: { in: members.map((m) => m.userId) },
      createdAt: { gte: earliest },
    },
    include: { user: { select: { username: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });

  const joinedAt = new Map(members.map((m) => [m.userId, m.joinedAt]));
  // Only what a member logged after joining counts toward the crew
  const counted = rows.filter(
    (r) => r.createdAt >= (joinedAt.get(r.userId) ?? r.createdAt)
  );
  const entries = counted.map(toBeerEntry);
  const sessions = groupIntoSessions(entries);

  const scores: CrewMemberScore[] = members.map((m) => {
    const own = entries.filter((e) => e.user_id === m.userId);
    const ownSessions = sessions.filter((s) => s.userId === m.userId);
    const venues = new Set(
      own.map((e) => e.venue?.trim()).filter((v): v is string => !!v)
    );
    return {
      userId: m.userId,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl,
      joinedAt: m.joinedAt.toISOString(),
      sessions: ownSessions.length,
      venues: venues.size,
    };
  });

  scores.sort((a, b) => b.sessions - a.sessions || b.venues - a.venues);

  return { scores, recentSessions: sessions.slice(0, 4) };
}
