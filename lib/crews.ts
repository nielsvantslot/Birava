import type { DrinkEntry } from "@prisma/client";
import { db } from "@/lib/db";
import { toDrinkEntry } from "@/lib/mappers";
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

/** The identity + join date a board needs per member — fetched by the caller. */
export type CrewMemberInput = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  joinedAt: Date;
};

/**
 * Pure scorer: given a crew's members and a (possibly larger) pool of
 * check-in rows, compute the leaderboard and recent sessions. Rows that
 * don't belong to a member, or predate that member's join, are ignored —
 * so the index can fetch every crew's rows in one query and slice per crew.
 */
export function scoreCrew(
  members: CrewMemberInput[],
  rows: DrinkEntry[]
): CrewBoard {
  if (members.length === 0) return { scores: [], recentSessions: [] };

  const joinedAt = new Map(members.map((m) => [m.userId, m.joinedAt]));
  const info = new Map(members.map((m) => [m.userId, m]));

  // Only what a member logged after joining counts toward the crew.
  const counted = rows.filter((r) => {
    const joined = joinedAt.get(r.userId);
    return joined !== undefined && r.createdAt >= joined;
  });
  const entries = counted.map(toDrinkEntry);
  const sessions = groupIntoSessions(entries);

  const scores: CrewMemberScore[] = members.map((m) => {
    const own = entries.filter((e) => e.user_id === m.userId);
    const ownSessions = sessions.filter((s) => s.userId === m.userId);
    const venues = new Set(
      own.map((e) => e.venue?.trim()).filter((v): v is string => !!v)
    );
    return {
      userId: m.userId,
      username: m.username,
      avatarUrl: m.avatarUrl,
      joinedAt: m.joinedAt.toISOString(),
      sessions: ownSessions.length,
      venues: venues.size,
    };
  });

  scores.sort((a, b) => b.sessions - a.sessions || b.venues - a.venues);

  // Identity isn't carried on the projected rows, so stamp it from members.
  const recentSessions = sessions.slice(0, 4).map((s) => ({
    ...s,
    username: info.get(s.userId)?.username ?? "",
    avatarUrl: info.get(s.userId)?.avatarUrl ?? null,
  }));

  return { scores, recentSessions };
}

/**
 * Board for a single crew — fetches that crew's since-earliest-join
 * check-ins and scores them. The member list is supplied by the caller,
 * which has already loaded it (so no per-crew re-query of members).
 */
export async function getCrewBoard(
  members: CrewMemberInput[]
): Promise<CrewBoard> {
  if (members.length === 0) return { scores: [], recentSessions: [] };

  const earliest = new Date(
    Math.min(...members.map((m) => m.joinedAt.getTime()))
  );
  const rows = await db.drinkEntry.findMany({
    where: {
      userId: { in: members.map((m) => m.userId) },
      createdAt: { gte: earliest },
    },
    orderBy: { createdAt: "asc" },
  });

  return scoreCrew(members, rows);
}
