import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { toDrinkEntry } from "@/lib/mappers";
import { VENUE_SELECT } from "@/lib/queries/venueSelect";
import { groupIntoSessions } from "@/lib/sessions";
import { ENGAGEMENT_RESOLUTION_WINDOW_MS, ENGAGEMENT_SAMPLE_SIZE } from "@/lib/sessionReminderAlgorithm";

/**
 * Every quiet user's own history of consecutive check-in gaps *within* a
 * session (never the gap that closes one) — the raw input to
 * personalizedQuietThresholdMs, keyed by userId. One query across every user
 * the reminder tick is considering, not one per user — sendSessionReminders
 * is the only caller, and a tick with many concurrently-quiet users
 * shouldn't pay a sequential round trip per user for this. Can't reuse
 * getDrinkHistory's per-user cache here regardless (there's no multi-key
 * form of it), so this reads fresh rather than cached — fine for a
 * periodic cron, not a per-request page load. Same 4-hour grouping rule as
 * the rest of the app (groupIntoSessions) instead of re-deriving "what
 * counts as one session" a second way.
 */
export async function getIntraSessionGapsForUsers(userIds: string[]): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  if (userIds.length === 0) return result;

  const entries = await db.drinkEntry.findMany({
    where: { userId: { in: userIds } },
    include: { venue: VENUE_SELECT },
    orderBy: { createdAt: "asc" },
  });

  const rowsByUser = new Map<string, typeof entries>();
  for (const entry of entries) {
    const list = rowsByUser.get(entry.userId);
    if (list) list.push(entry);
    else rowsByUser.set(entry.userId, [entry]);
  }

  for (const userId of userIds) {
    const history = (rowsByUser.get(userId) ?? []).map(toDrinkEntry);
    const sessions = groupIntoSessions(history);
    const gaps: number[] = [];
    for (const session of sessions) {
      for (let i = 1; i < session.checkins.length; i++) {
        const prev = new Date(session.checkins[i - 1].created_at).getTime();
        const curr = new Date(session.checkins[i].created_at).getTime();
        gaps.push(curr - prev);
      }
    }
    result.set(userId, gaps);
  }
  return result;
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

type EngagementRow = { userId: string; openedAt: Date | null };

/**
 * How often each user has actually opened their last ENGAGEMENT_SAMPLE_SIZE
 * SESSION_REMINDER notifications, restricted to ones old enough
 * (ENGAGEMENT_RESOLUTION_WINDOW_MS) that they've had a fair chance to see —
 * a reminder sent five minutes ago isn't evidence of anything yet. Feeds
 * maxRemindersForEngagement. Keyed by userId, one query for every user the
 * reminder tick is considering (see getIntraSessionGapsForUsers above for
 * why this is batched rather than per-user).
 *
 * "Top N per user" has no Prisma-native equivalent (no per-group `take`), so
 * this is a raw query with a ROW_NUMBER() window partitioned by user —
 * fetching a flat, generously-bounded window and slicing per user in JS
 * instead would risk starving a user's sample if a few other users in the
 * same tick happen to have far more recent reminders than everyone else.
 */
export async function getReminderEngagementForUsers(userIds: string[]): Promise<Map<string, ReminderEngagement>> {
  const result = new Map<string, ReminderEngagement>();
  if (userIds.length === 0) return result;
  for (const userId of userIds) result.set(userId, { openedCount: 0, resolvedCount: 0 });

  const cutoff = new Date(Date.now() - ENGAGEMENT_RESOLUTION_WINDOW_MS);
  const rows = await db.$queryRaw<EngagementRow[]>`
    SELECT "userId", "openedAt"
    FROM (
      SELECT "userId", "openedAt",
        ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" DESC) AS rn
      FROM "Notification"
      WHERE "userId"::text IN (${Prisma.join(userIds)})
        AND "type" = 'SESSION_REMINDER'
        AND "createdAt" < ${cutoff}
    ) ranked
    WHERE rn <= ${ENGAGEMENT_SAMPLE_SIZE}
  `;

  for (const row of rows) {
    const engagement = result.get(row.userId);
    if (!engagement) continue;
    engagement.resolvedCount += 1;
    if (row.openedAt !== null) engagement.openedCount += 1;
  }
  return result;
}
