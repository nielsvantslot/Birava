import { BeerEntry } from "@/lib/types";
import { localParts, weekIndex } from "@/lib/dates";

/**
 * The session is Birava's hero unit: check-ins auto-group into a session,
 * and a session ends after 4 hours with no new check-in (locked rule —
 * there is no manual start/end). A lone check-in is a session of one.
 */
export const SESSION_GAP_MS = 4 * 60 * 60 * 1000;

export type DrinkSession = {
  /** Id of the first check-in — the stable handle for /sessions/[id]. */
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  start: string; // ISO
  end: string; // ISO
  /** Ascending by time — the session's "splits". */
  checkins: BeerEntry[];
  /** Distinct venues in first-visit order. */
  venues: string[];
  /** Distinct drink types in first-pour order. */
  types: string[];
  /**
   * Ids of check-ins that have a photo, chronological. Render via
   * beerPhotoSrc(id) — photos are served through /api/photos/[entryId]
   * so blob storage (prod) and local disk (dev) both work.
   */
  photoIds: string[];
};

function ts(entry: BeerEntry): number {
  return new Date(entry.created_at).getTime();
}

function buildSession(checkins: BeerEntry[]): DrinkSession {
  const first = checkins[0];
  const last = checkins[checkins.length - 1];

  const venues: string[] = [];
  const types: string[] = [];
  for (const c of checkins) {
    const venue = c.venue?.trim();
    if (venue && !venues.includes(venue)) venues.push(venue);
    if (c.drink_type && !types.includes(c.drink_type)) types.push(c.drink_type);
  }

  return {
    id: first.id,
    userId: first.user_id,
    username: first.profiles?.username ?? "",
    avatarUrl: first.profiles?.avatar_url ?? null,
    start: first.created_at,
    end: last.created_at,
    checkins,
    venues,
    types,
    photoIds: checkins.filter((c) => !!c.photo_url).map((c) => c.id),
  };
}

/** Group check-ins into sessions per user by the 4-hour-gap rule. */
export function groupIntoSessions(entries: BeerEntry[]): DrinkSession[] {
  const byUser = new Map<string, BeerEntry[]>();
  for (const entry of entries) {
    const bucket = byUser.get(entry.user_id);
    if (bucket) bucket.push(entry);
    else byUser.set(entry.user_id, [entry]);
  }

  const sessions: DrinkSession[] = [];
  for (const bucket of byUser.values()) {
    bucket.sort((a, b) => ts(a) - ts(b));
    let current: BeerEntry[] = [];
    for (const entry of bucket) {
      if (
        current.length > 0 &&
        ts(entry) - ts(current[current.length - 1]) > SESSION_GAP_MS
      ) {
        sessions.push(buildSession(current));
        current = [];
      }
      current.push(entry);
    }
    if (current.length > 0) sessions.push(buildSession(current));
  }

  return sessions.sort(
    (a, b) => new Date(b.end).getTime() - new Date(a.end).getTime()
  );
}

/** The session that contains a given check-in, or null. */
export function findSessionWithCheckin(
  entries: BeerEntry[],
  checkinId: string
): DrinkSession | null {
  return (
    groupIntoSessions(entries).find((s) =>
      s.checkins.some((c) => c.id === checkinId)
    ) ?? null
  );
}

/** Duration in minutes (0 for a session of one). */
export function sessionMinutes(session: DrinkSession): number {
  return Math.round(
    (new Date(session.end).getTime() - new Date(session.start).getTime()) /
      60000
  );
}

/**
 * Serif card title. Multi check-in sessions get a time-of-day name from
 * the session's local start; a session of one is titled by its drink.
 */
export function sessionTitle(session: DrinkSession, tz: string): string {
  if (session.checkins.length === 1) {
    const only = session.checkins[0];
    return only.beer_name?.trim() || only.drink_type || "Check-in";
  }
  const { hour } = localParts(new Date(session.start), tz);
  if (hour < 6) return "Late session";
  if (hour < 12) return "Morning session";
  if (hour < 18) return "Afternoon session";
  return "Evening session";
}

/**
 * "Local Legend" venue: the venue with the most check-ins over the last
 * 90 days, if it has at least 3.
 */
export function getLocalLegendVenue(
  entries: Array<Pick<BeerEntry, "venue" | "created_at">>
): string | null {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const venue = entry.venue?.trim();
    if (!venue) continue;
    if (new Date(entry.created_at).getTime() < cutoff) continue;
    counts.set(venue, (counts.get(venue) ?? 0) + 1);
  }

  let top: string | null = null;
  let topCount = 0;
  for (const [venue, count] of counts) {
    if (count > topCount) {
      top = venue;
      topCount = count;
    }
  }

  return topCount >= 3 ? top : null;
}

export type ActiveWeeks = {
  /** Active weeks in the current run (rest weeks don't count, one doesn't break it). */
  current: number;
  /** Longest run so far. */
  best: number;
  /** Last 12 calendar weeks, oldest first — true = had a session. */
  strip: boolean[];
};

/**
 * The active-weeks streak: a week is active when it has at least one
 * session. A single rest week reads as recovery and survives the run;
 * two or more consecutive rest weeks end it. Never day-based.
 */
export function activeWeeks(
  sessions: DrinkSession[],
  tz: string,
  now: Date = new Date()
): ActiveWeeks {
  const active = new Set<number>();
  for (const s of sessions) active.add(weekIndex(new Date(s.start), tz));

  const thisWeek = weekIndex(now, tz);
  const strip = Array.from({ length: 12 }, (_, i) =>
    active.has(thisWeek - 11 + i)
  );

  if (active.size === 0) return { current: 0, best: 0, strip };

  const weeks = [...active].sort((a, b) => a - b);

  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const w of weeks) {
    run = prev !== null && w - prev <= 2 ? run + 1 : 1;
    prev = w;
    if (run > best) best = run;
  }

  // Current run: walk back from the newest active week; the run is still
  // alive if that week is this week or within the one-rest-week grace.
  const newest = weeks[weeks.length - 1];
  let current = 0;
  if (thisWeek - newest <= 2) {
    current = 1;
    for (let i = weeks.length - 2; i >= 0; i--) {
      if (weeks[i + 1] - weeks[i] <= 2) current++;
      else break;
    }
  }

  return { current, best, strip };
}
