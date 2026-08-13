import { db } from "@/lib/db";
import { getDrinkHistory } from "@/lib/queries/drinkEntryQueries";
import { groupIntoSessions } from "@/lib/sessions";
import { ENGAGEMENT_RESOLUTION_WINDOW_MS, ENGAGEMENT_SAMPLE_SIZE } from "@/lib/sessionReminderAlgorithm";

/**
 * A user's own history of consecutive check-in gaps *within* a session
 * (never the gap that closes one) — the raw input to
 * personalizedQuietThresholdMs. Reuses getDrinkHistory's cached full history
 * and the same 4-hour grouping rule as the rest of the app instead of
 * re-deriving "what counts as one session" a second way.
 */
export async function getIntraSessionGapsForUser(userId: string): Promise<number[]> {
  const history = await getDrinkHistory(userId);
  const sessions = groupIntoSessions(history);

  const gaps: number[] = [];
  for (const session of sessions) {
    for (let i = 1; i < session.checkins.length; i++) {
      const prev = new Date(session.checkins[i - 1].created_at).getTime();
      const curr = new Date(session.checkins[i].created_at).getTime();
      gaps.push(curr - prev);
    }
  }
  return gaps;
}

/**
 * Each of the given sessions' own intra-session check-in gaps, keyed by
 * session id — the "this session's actual pace so far" input to
 * expectedGapMs, preferred over a user's cross-session historical median
 * the moment there's any evidence of it.
 */
export async function getIntraSessionGapsBySessionId(sessionIds: string[]): Promise<Map<string, number[]>> {
  if (sessionIds.length === 0) return new Map();

  const entries = await db.drinkEntry.findMany({
    where: { sessionId: { in: sessionIds } },
    select: { sessionId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const timestampsBySession = new Map<string, Date[]>();
  for (const entry of entries) {
    const list = timestampsBySession.get(entry.sessionId);
    if (list) list.push(entry.createdAt);
    else timestampsBySession.set(entry.sessionId, [entry.createdAt]);
  }

  const gapsBySession = new Map<string, number[]>();
  for (const [sessionId, timestamps] of timestampsBySession) {
    const gaps: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      gaps.push(timestamps[i].getTime() - timestamps[i - 1].getTime());
    }
    gapsBySession.set(sessionId, gaps);
  }
  return gapsBySession;
}

export type ReminderEngagement = { openedCount: number; resolvedCount: number };

/**
 * How often a user has actually opened their last ENGAGEMENT_SAMPLE_SIZE
 * SESSION_REMINDER notifications, restricted to ones old enough
 * (ENGAGEMENT_RESOLUTION_WINDOW_MS) that they've had a fair chance to see —
 * a reminder sent five minutes ago isn't evidence of anything yet. Feeds
 * maxRemindersForEngagement.
 */
export async function getReminderEngagementForUser(userId: string): Promise<ReminderEngagement> {
  const rows = await db.notification.findMany({
    where: {
      userId,
      type: "SESSION_REMINDER",
      createdAt: { lt: new Date(Date.now() - ENGAGEMENT_RESOLUTION_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
    take: ENGAGEMENT_SAMPLE_SIZE,
    select: { openedAt: true },
  });

  return {
    openedCount: rows.filter((r) => r.openedAt !== null).length,
    resolvedCount: rows.length,
  };
}
