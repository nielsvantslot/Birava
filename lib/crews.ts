import type { DrinkEntry } from "@prisma/client";
import { toDrinkEntry } from "@/lib/mappers";
import { DrinkSession, groupIntoSessions } from "@/lib/sessions";

/**
 * Crew scoring: everyone is ranked from the day they joined — never
 * lifetime totals, so joining a crew with history doesn't auto-win it.
 * Primary metric is sessions; ties break on total drinks logged since
 * joining. Drink counts are otherwise excluded app-wide ("celebrate variety,
 * never volume") — crew leaderboards are a deliberate, scoped exception,
 * since crews are private/opt-in/time-boxed rather than the ambient
 * feed/stats screens that rule targets. See CLAUDE.md.
 */
export type CrewMemberScore = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isDeveloper: boolean;
  joinedAt: string; // ISO
  sessions: number;
  venues: number;
  drinks: number;
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
  isDeveloper: boolean;
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
  rows: DrinkEntry[],
  closedAt: Date | null = null
): CrewBoard {
  if (members.length === 0) return { scores: [], recentSessions: [] };

  const cutoff = closedAt ?? new Date();
  const joinedAt = new Map(members.map((m) => [m.userId, m.joinedAt]));
  const info = new Map(members.map((m) => [m.userId, m]));

  // Only what a member logged after joining, and before the crew closed
  // (if it has), counts toward the crew.
  const counted = rows.filter((r) => {
    const joined = joinedAt.get(r.userId);
    return joined !== undefined && r.createdAt >= joined && r.createdAt <= cutoff;
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
      isDeveloper: m.isDeveloper,
      joinedAt: m.joinedAt.toISOString(),
      sessions: ownSessions.length,
      venues: venues.size,
      drinks: own.length,
    };
  });

  scores.sort((a, b) => b.sessions - a.sessions || b.drinks - a.drinks);

  // Identity isn't carried on the projected rows, so stamp it from members.
  const recentSessions = sessions.slice(0, 4).map((s) => ({
    ...s,
    username: info.get(s.userId)?.username ?? "",
    avatarUrl: info.get(s.userId)?.avatarUrl ?? null,
    isDeveloper: info.get(s.userId)?.isDeveloper ?? false,
  }));

  return { scores, recentSessions };
}
