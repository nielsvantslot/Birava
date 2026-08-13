/**
 * Bounds a user's own observed gap between drinks gets clamped into. Keeps a
 * very fast logger from getting nudged within minutes, and a very sparse
 * logger from waiting almost the full SESSION_GAP_MS before ever hearing
 * from the reminder.
 */
export const MIN_EXPECTED_GAP_MS = 30 * 60 * 1000; // 30 min
export const MAX_EXPECTED_GAP_MS = 90 * 60 * 1000; // 90 min

/** Fallback gap for a user with no usable history yet (today's old constant). */
export const DEFAULT_EXPECTED_GAP_MS = 60 * 60 * 1000; // 1 hour

/**
 * How much later than the expected gap a user has to go quiet before we
 * assume they've got an unlogged drink, rather than genuinely still be on
 * their last one. E.g. a 60min expected gap only counts as overdue at 75min.
 */
export const OVERDUE_BUFFER_MS = 15 * 60 * 1000; // 15 min

const ENGAGEMENT_COLD_START_SAMPLE = 3;
const ENGAGEMENT_LOW_RATE_CUTOFF = 1 / 3;

/** How many of a user's past reminders to sample when scoring engagement. */
export const ENGAGEMENT_SAMPLE_SIZE = 10;

/** A reminder only counts toward engagement scoring once it's had a fair
 * chance to be opened — otherwise a just-sent reminder would count as
 * "ignored" before the user could plausibly have seen it. */
export const ENGAGEMENT_RESOLUTION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Median of a set of millisecond gaps, or null for an empty input. */
export function medianGapMs(gaps: number[]): number | null {
  if (gaps.length === 0) return null;
  const sorted = [...gaps].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * A user's expected gap between drinks: the median of *this session's own*
 * check-in gaps so far, so tonight's actual pace wins the moment there's any
 * evidence of it. Falls back to the user's historical median (other
 * sessions) once this session has one, then to DEFAULT_EXPECTED_GAP_MS if
 * there's no history at all. Either way, clamped to
 * [MIN_EXPECTED_GAP_MS, MAX_EXPECTED_GAP_MS].
 */
export function expectedGapMs(sessionGaps: number[], historicalGaps: number[]): number {
  const median = medianGapMs(sessionGaps.length > 0 ? sessionGaps : historicalGaps);
  if (median === null) return DEFAULT_EXPECTED_GAP_MS;
  return Math.min(MAX_EXPECTED_GAP_MS, Math.max(MIN_EXPECTED_GAP_MS, median));
}

/**
 * How many reminder "slots" are due given how long it's been since the
 * check-in that started this quiet stretch. Slot 1 is due at
 * `gapMs + OVERDUE_BUFFER_MS` (the user's usual gap, plus a buffer so a
 * still-on-their-last-drink user isn't nudged early); each further slot is
 * one more full gap after that — a *consistent* cadence, not an escalating
 * multiplier, so catching up on a missed drink never requires waiting
 * longer than usual for the next nudge.
 */
export function dueSlotsForElapsed(elapsedMs: number, gapMs: number): number {
  if (elapsedMs < OVERDUE_BUFFER_MS) return 0;
  return Math.floor((elapsedMs - OVERDUE_BUFFER_MS) / gapMs);
}

/**
 * The most reminders a user is eligible to receive per *quiet stretch*
 * (resets the moment they log a new check-in — see sessionReminderCommands),
 * based on how often they've actually opened past SESSION_REMINDER
 * notifications (Notification.openedAt). A user with no engagement history
 * yet gets the benefit of the doubt (2); a user who has never opened one
 * gets capped at 1 — exactly today's single-reminder behavior, so a
 * consistently-unresponsive user never gets *more* nudges than before, only
 * a responsive one gets more.
 */
export function maxRemindersForEngagement(openedCount: number, resolvedCount: number): 1 | 2 | 3 {
  if (resolvedCount < ENGAGEMENT_COLD_START_SAMPLE) return 2;
  if (openedCount === 0) return 1;
  const rate = openedCount / resolvedCount;
  if (rate < ENGAGEMENT_LOW_RATE_CUTOFF) return 2;
  return 3;
}
