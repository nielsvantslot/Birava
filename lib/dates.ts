/**
 * TZ-aware date helpers. All day/week math in the app goes through here,
 * computed in the *user's* time zone (see lib/timezone.ts), never the
 * server's. Pure functions — safe to import from client and server code.
 */

const DAY_MS = 86_400_000;

/**
 * `Intl.DateTimeFormat` construction is expensive (~50µs each). These
 * helpers run per check-in via weekIndex/dayNumber on the history screens,
 * so a fresh formatter per call turned into O(account-age) wall-clock time
 * (≈120ms of pure formatter construction at 2 000 check-ins). The formatter
 * is immutable for a given (tz, variant), so memoize it module-wide.
 */
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(
  variant: string,
  tz: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const key = `${variant}|${tz}`;
  let fmt = fmtCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...options });
    fmtCache.set(key, fmt);
  }
  return fmt;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

type LocalParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
};

export function localParts(date: Date, tz: string): LocalParts {
  const fmt = formatter("localParts", tz, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24, // "24" at midnight in some engines
    minute: Number(parts.minute),
  };
}

/** Days since epoch of the local calendar day this instant falls on. */
export function dayNumber(date: Date, tz: string): number {
  const p = localParts(date, tz);
  return Date.UTC(p.year, p.month - 1, p.day) / DAY_MS;
}

/**
 * Monday-based week index since epoch. Consecutive calendar weeks have
 * consecutive indices — this is the unit of the active-weeks streak.
 */
export function weekIndex(date: Date, tz: string): number {
  return Math.floor((dayNumber(date, tz) + 3) / 7);
}

/** "18:27" in the user's time zone. */
export function formatTime(date: Date, tz: string): string {
  const p = localParts(date, tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** "Today" / "Yesterday" / "Mon" (this week) / "12 Jun" / "12 Jun 2025". */
export function relativeDay(date: Date, tz: string, now: Date = new Date()): string {
  const diff = dayNumber(now, tz) - dayNumber(date, tz);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) {
    return formatter("weekday", tz, { weekday: "short" }).format(date);
  }
  const sameYear = localParts(date, tz).year === localParts(now, tz).year;
  return formatter(sameYear ? "dayMonth" : "dayMonthYear", tz, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

/** "Yesterday, 18:27" — the session-card meta format. */
export function relativeDayTime(date: Date, tz: string, now: Date = new Date()): string {
  return `${relativeDay(date, tz, now)}, ${formatTime(date, tz)}`;
}

/** "just now" / "12m ago" / "5h ago" / "Yesterday" / "12 Jun". */
export function timeAgo(date: Date, tz: string, now: Date = new Date()): string {
  const mins = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24 && dayNumber(now, tz) === dayNumber(date, tz)) {
    return `${hours}h ago`;
  }
  return relativeDay(date, tz, now);
}

/** "12 Jun 2026" absolute date. */
export function formatDate(date: Date, tz: string): string {
  return formatter("formatDate", tz, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
