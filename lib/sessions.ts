import { DrinkEntry } from "@/lib/types";
import { localParts, weekIndex } from "@/lib/dates";

/**
 * The session is Birava's hero unit: check-ins auto-group into a session,
 * and a session ends after 4 hours with no new check-in (locked rule —
 * there is no manual start/end). A lone check-in is a session of one.
 */
export const SESSION_GAP_MS = 4 * 60 * 60 * 1000;

/**
 * How far into the past a check-in's createdAt may be backdated (offline
 * sync recovering something logged hours ago) before the server stops
 * trusting it and falls back to now(). Generous relative to any realistic
 * offline queue, since createDrinkEntry is a "use server" action — any
 * caller can set createdAt, not just the offline-sync flow — and
 * achievements/streaks would otherwise be gameable by backdating freely.
 */
export const MAX_BACKDATE_MS = 7 * 24 * 60 * 60 * 1000;

export type DrinkSession = {
  /** Id of the first check-in — the stable handle for /sessions/[id]. */
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  start: string; // ISO
  end: string; // ISO
  /** Ascending by time — the session's "splits". */
  checkins: DrinkEntry[];
  /** Distinct venues in first-visit order. */
  venues: string[];
  /** Distinct drink types in first-pour order. */
  types: string[];
  /**
   * Ids of check-ins that have a photo, chronological. Render via
   * drinkPhotoSrc(id) — photos are served through /api/photos/[entryId]
   * so blob storage (prod) and local disk (dev) both work.
   */
  photoIds: string[];
};

function ts(entry: DrinkEntry): number {
  return new Date(entry.created_at).getTime();
}

function deriveVenuesTypesPhotos(checkins: DrinkEntry[]): {
  venues: string[];
  types: string[];
  photoIds: string[];
} {
  const venues: string[] = [];
  const types: string[] = [];
  for (const c of checkins) {
    const venue = c.venue?.trim();
    if (venue && !venues.includes(venue)) venues.push(venue);
    if (c.drink_type && !types.includes(c.drink_type)) types.push(c.drink_type);
  }
  return { venues, types, photoIds: checkins.filter((c) => !!c.photo_url).map((c) => c.id) };
}

/**
 * Assembles a DrinkSession from its authoritative identity/bounds (a real
 * DrinkSession row) plus its checkins. Unlike buildSession, identity isn't
 * re-derived from checkins[0] — a session's id is permanent once created,
 * so a backdated check-in can become chronologically first without the
 * session's id changing to match. Used by the DB-backed queries in
 * lib/queries/drinkSessionQueries.ts.
 */
export function assembleDrinkSession(
  identity: {
    id: string;
    userId: string;
    username: string;
    avatarUrl: string | null;
    start: string;
    end: string;
  },
  checkins: DrinkEntry[]
): DrinkSession {
  return { ...identity, checkins, ...deriveVenuesTypesPhotos(checkins) };
}

function buildSession(checkins: DrinkEntry[]): DrinkSession {
  const first = checkins[0];
  const last = checkins[checkins.length - 1];

  return {
    id: first.id,
    userId: first.user_id,
    username: first.profiles?.username ?? "",
    avatarUrl: first.profiles?.avatar_url ?? null,
    start: first.created_at,
    end: last.created_at,
    checkins,
    ...deriveVenuesTypesPhotos(checkins),
  };
}

/** Group check-ins into sessions per user by the 4-hour-gap rule. */
export function groupIntoSessions(entries: DrinkEntry[]): DrinkSession[] {
  const byUser = new Map<string, DrinkEntry[]>();
  for (const entry of entries) {
    const bucket = byUser.get(entry.user_id);
    if (bucket) bucket.push(entry);
    else byUser.set(entry.user_id, [entry]);
  }

  const sessions: DrinkSession[] = [];
  for (const bucket of byUser.values()) {
    bucket.sort((a, b) => ts(a) - ts(b));
    let current: DrinkEntry[] = [];
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
  entries: DrinkEntry[],
  checkinId: string
): DrinkSession | null {
  return (
    groupIntoSessions(entries).find((s) =>
      s.checkins.some((c) => c.id === checkinId)
    ) ?? null
  );
}

function sessionSpanMs(session: DrinkSession): number {
  return new Date(session.end).getTime() - new Date(session.start).getTime();
}

/** Duration in minutes (0 for a session of one). */
export function sessionMinutes(session: DrinkSession): number {
  return Math.round(sessionSpanMs(session) / 60000);
}

/** Duration in seconds (0 for a session of one) — finer-grained than sessionMinutes, for pace math. */
export function sessionSeconds(session: DrinkSession): number {
  return Math.round(sessionSpanMs(session) / 1000);
}

/** Human duration for a span of minutes: "3h 20m", "45m", "2h". */
export function formatSessionDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Human pace for a span of seconds: "45s", "3m", "3m 20s", "1h 5m". Unlike
 * formatSessionDuration, this keeps seconds — a sub-minute pace (e.g. several
 * check-ins logged in quick succession) would otherwise round down to "0m".
 */
export function formatPace(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return m === 0 ? `${h}h` : `${h}h ${m}m`;
  if (m > 0) return s === 0 ? `${m}m` : `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Serif card title. Multi check-in sessions get a time-of-day name from
 * the session's local start; a session of one is titled by its drink.
 */
export function sessionTitle(session: DrinkSession, tz: string): string {
  if (session.checkins.length === 1) {
    const only = session.checkins[0];
    return only.drink_name?.trim() || only.drink_type || "Check-in";
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
  entries: Array<Pick<DrinkEntry, "venue" | "created_at">>
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
