import { SESSION_GAP_MS } from "@/lib/sessions";

/**
 * Personalized quiet-threshold bounds — the floor/ceiling a user's own median
 * intra-session gap gets clamped into. Keeps a very fast logger from getting
 * nudged within minutes, and a very sparse logger from waiting almost the
 * full SESSION_GAP_MS before ever hearing from the reminder.
 */
export const MIN_QUIET_THRESHOLD_MS = 30 * 60 * 1000; // 30 min
export const MAX_QUIET_THRESHOLD_MS = 90 * 60 * 1000; // 90 min

/** Fallback threshold for a user with no usable history yet (today's old constant). */
export const DEFAULT_QUIET_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

/** Ceilings for tiers 2 and 3, so a large personalized threshold can't push a
 * later tier past SESSION_GAP_MS (4h) and leave no room for it to ever fire. */
const TIER_2_CEILING_MS = 180 * 60 * 1000; // 3h
const TIER_3_CEILING_MS = 210 * 60 * 1000; // 3.5h — 30min buffer before the 4h hard close

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
 * A user's personalized "gone quiet" threshold: their own median intra-session
 * check-in gap, clamped to [MIN_QUIET_THRESHOLD_MS, MAX_QUIET_THRESHOLD_MS].
 * Falls back to DEFAULT_QUIET_THRESHOLD_MS when there's no history yet.
 */
export function personalizedQuietThresholdMs(medianGap: number | null): number {
  if (medianGap === null) return DEFAULT_QUIET_THRESHOLD_MS;
  return Math.min(MAX_QUIET_THRESHOLD_MS, Math.max(MIN_QUIET_THRESHOLD_MS, medianGap));
}

/**
 * Escalation tiers built off a user's personalized threshold: tier 1 fires at
 * the threshold itself, tier 2 at 2x (capped), tier 3 at 3.5x (capped further
 * back, to leave a buffer before SESSION_GAP_MS permanently closes the
 * session and no further reminder could ever land).
 */
export function tierBoundariesMs(thresholdMs: number): [number, number, number] {
  const tier1 = thresholdMs;
  const tier2 = Math.min(thresholdMs * 2, TIER_2_CEILING_MS);
  const tier3 = Math.min(thresholdMs * 3.5, TIER_3_CEILING_MS, SESSION_GAP_MS - 30 * 60 * 1000);
  return [tier1, tier2, tier3];
}

/** How many escalation tiers are due given how long the session has been quiet. */
export function dueTierForElapsed(elapsedMs: number, tiers: [number, number, number]): 0 | 1 | 2 | 3 {
  if (elapsedMs >= tiers[2]) return 3;
  if (elapsedMs >= tiers[1]) return 2;
  if (elapsedMs >= tiers[0]) return 1;
  return 0;
}

/**
 * The most reminders a user is eligible to receive per session, based on how
 * often they've actually opened past SESSION_REMINDER notifications
 * (Notification.openedAt). A user with no engagement history yet gets the
 * benefit of the doubt (2); a user who has never opened one gets capped at 1
 * — exactly today's single-reminder behavior, so a consistently-unresponsive
 * user never gets *more* nudges than before, only a responsive one gets more.
 */
export function maxRemindersForEngagement(openedCount: number, resolvedCount: number): 1 | 2 | 3 {
  if (resolvedCount < ENGAGEMENT_COLD_START_SAMPLE) return 2;
  if (openedCount === 0) return 1;
  const rate = openedCount / resolvedCount;
  if (rate < ENGAGEMENT_LOW_RATE_CUTOFF) return 2;
  return 3;
}
