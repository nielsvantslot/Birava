import { DrinkEntry, DRINK_TYPES } from "@/lib/types";
import { countSessions, getLocalLegendVenue, LOCAL_LEGEND_WINDOW_MS } from "@/lib/sessions";
import { weekIndex } from "@/lib/dates";

/** Every field computeAchievements/earnedIds actually read — callers with the full DrinkEntry shape still satisfy this. */
type AchievementEntry = Pick<
  DrinkEntry,
  "user_id" | "created_at" | "drink_type" | "venue"
>;

/**
 * Every badge rewards variety — new types, venues, places — never how
 * much you drink. No count-based badges, by design.
 */
export type AchievementIcon =
  | "star"
  | "pin"
  | "badge"
  | "glass"
  | "repeat";

export type VarietyAchievement = {
  id: string;
  label: string;
  description: string;
  icon: AchievementIcon;
  progress: number;
  goal: number;
  earned: boolean;
  /** e.g. "3 of 4 types" or "Earned · The Local Taphouse" */
  progressText: string;
};

type AchievementId = "first_round" | "range" | "cartographer" | "local_legend" | "regular";

/** Static label/description/icon per achievement — shared by computeAchievements (display) and newlyEarnedAchievements (the check-in write path), so there's one place these read from either way. */
const ACHIEVEMENT_META: Record<AchievementId, Pick<VarietyAchievement, "label" | "description" | "icon">> = {
  first_round: { label: "First Round", description: "Log your very first session.", icon: "glass" },
  range: { label: "Range", description: "Log all 4 drink types. Beer, wine, cocktail and other.", icon: "star" },
  cartographer: { label: "Cartographer", description: "Explore 25 different venues.", icon: "pin" },
  local_legend: {
    label: "Local Legend",
    description: "Most check-ins at one venue over 90 days. Hold it to keep the crown.",
    icon: "badge",
  },
  regular: { label: "Regular", description: "Return to the same venue in 5 different weeks.", icon: "repeat" },
};

/**
 * The shared per-entry aggregation every variety achievement besides
 * "first round" and "local legend" is built from — one O(history) pass.
 * Kept separate from computeAchievements() so newlyEarnedAchievements below
 * can build this once from "before" state and update it incrementally for
 * the single new entry, instead of paying this pass twice.
 */
type Aggregates = {
  hasAnyEntry: boolean;
  types: Set<string>;
  venues: Set<string>;
  weeksPerVenue: Map<string, Set<number>>;
};

function aggregate(entries: AchievementEntry[], tz: string): Aggregates {
  const types = new Set<string>();
  const venues = new Set<string>();
  const weeksPerVenue = new Map<string, Set<number>>();
  for (const e of entries) {
    if (e.drink_type) types.add(e.drink_type);
    const venue = e.venue?.trim();
    if (!venue) continue;
    venues.add(venue);
    const weeks = weeksPerVenue.get(venue) ?? new Set<number>();
    weeks.add(weekIndex(new Date(e.created_at), tz));
    weeksPerVenue.set(venue, weeks);
  }
  return { hasAnyEntry: entries.length > 0, types, venues, weeksPerVenue };
}

/** The venue with the most distinct weeks visited, and that count — "Regular"'s progress. */
function bestRegular(weeksPerVenue: Map<string, Set<number>>): { weeks: number; venue: string | null } {
  let weeks = 0;
  let venue: string | null = null;
  for (const [v, w] of weeksPerVenue) {
    if (w.size > weeks) {
      weeks = w.size;
      venue = v;
    }
  }
  return { weeks, venue };
}

export function computeAchievements(
  entries: AchievementEntry[],
  tz: string
): VarietyAchievement[] {
  const sessionCount = countSessions(entries);
  const { types, venues, weeksPerVenue } = aggregate(entries, tz);
  const legendVenue = getLocalLegendVenue(entries);
  const { weeks: regularWeeks, venue: regularVenue } = bestRegular(weeksPerVenue);

  const range = Math.min(types.size, DRINK_TYPES.length);
  const cartographer = Math.min(venues.size, 25);
  const regular = Math.min(regularWeeks, 5);

  return [
    {
      id: "first_round",
      ...ACHIEVEMENT_META.first_round,
      progress: Math.min(sessionCount, 1),
      goal: 1,
      earned: sessionCount >= 1,
      progressText: sessionCount >= 1 ? "Earned" : "0 of 1 sessions",
    },
    {
      id: "range",
      ...ACHIEVEMENT_META.range,
      progress: range,
      goal: DRINK_TYPES.length,
      earned: range >= DRINK_TYPES.length,
      progressText:
        range >= DRINK_TYPES.length
          ? "Earned · all 4 types"
          : `${range} of ${DRINK_TYPES.length} types`,
    },
    {
      id: "cartographer",
      ...ACHIEVEMENT_META.cartographer,
      progress: cartographer,
      goal: 25,
      earned: venues.size >= 25,
      progressText:
        venues.size >= 25
          ? `Earned · ${venues.size} venues`
          : `${venues.size} of 25 venues`,
    },
    {
      id: "local_legend",
      ...ACHIEVEMENT_META.local_legend,
      progress: legendVenue ? 1 : 0,
      goal: 1,
      earned: !!legendVenue,
      progressText: legendVenue ? `Earned · ${legendVenue}` : "Not yet earned",
    },
    {
      id: "regular",
      ...ACHIEVEMENT_META.regular,
      progress: regular,
      goal: 5,
      earned: regularWeeks >= 5,
      progressText:
        regularWeeks >= 5
          ? `Earned · ${regularVenue}`
          : `${regularWeeks} of 5 weeks`,
    },
  ];
}

export function earnedIds(entries: AchievementEntry[], tz: string): Set<string> {
  return new Set(
    computeAchievements(entries, tz)
      .filter((a) => a.earned)
      .map((a) => a.id)
  );
}

/**
 * Which achievements newly become earned by adding exactly one entry to a
 * user's history. Used only by the check-in write path
 * (lib/commands/drinkEntryCommands.ts), which can't reuse the cached
 * getDrinkHistory read (it needs fresh pre-write state) and so pays a full
 * O(history) scan on every write regardless — this at least avoids paying
 * it *twice* (computeAchievements on "before", then again on "before + new
 * entry") by building the shared aggregates once from `beforeEntries` and
 * deriving the "after" state incrementally from just the one new entry.
 * Local Legend's own 90-day window is applied here too (matching
 * getLocalLegendVenue's own cutoff) so that check doesn't rescan the user's
 * full lifetime history just to look at the last 90 days of it, twice.
 *
 * Display pages (achievements/stats/profile) don't need any of this — they
 * only ever compute one state (whatever's currently in the DB), so
 * computeAchievements() as-is remains the right tool there.
 */
export function newlyEarnedAchievements(
  beforeEntries: AchievementEntry[],
  newEntry: AchievementEntry,
  tz: string
): { id: string; label: string }[] {
  const before = aggregate(beforeEntries, tz);
  const bestBefore = bestRegular(before.weeksPerVenue);

  const legendCutoff = Date.now() - LOCAL_LEGEND_WINDOW_MS;
  const recentBeforeEntries = beforeEntries.filter((e) => new Date(e.created_at).getTime() >= legendCutoff);
  const legendBefore = getLocalLegendVenue(recentBeforeEntries);

  const earnedBefore = {
    first_round: before.hasAnyEntry,
    range: before.types.size >= DRINK_TYPES.length,
    cartographer: before.venues.size >= 25,
    local_legend: legendBefore !== null,
    regular: bestBefore.weeks >= 5,
  };

  const newType = newEntry.drink_type;
  const typesAfterSize = newType && !before.types.has(newType) ? before.types.size + 1 : before.types.size;

  const newVenue = newEntry.venue?.trim();
  const venuesAfterSize = newVenue && !before.venues.has(newVenue) ? before.venues.size + 1 : before.venues.size;

  let regularAfterWeeks = bestBefore.weeks;
  if (newVenue) {
    const existingWeeks = before.weeksPerVenue.get(newVenue);
    const week = weekIndex(new Date(newEntry.created_at), tz);
    const venueWeeksAfter = existingWeeks ? (existingWeeks.has(week) ? existingWeeks.size : existingWeeks.size + 1) : 1;
    regularAfterWeeks = Math.max(regularAfterWeeks, venueWeeksAfter);
  }

  const legendAfter = getLocalLegendVenue([...recentBeforeEntries, newEntry]);

  const earnedAfter: Record<AchievementId, boolean> = {
    first_round: true, // adding an entry always means at least one now exists
    range: typesAfterSize >= DRINK_TYPES.length,
    cartographer: venuesAfterSize >= 25,
    local_legend: legendAfter !== null,
    regular: regularAfterWeeks >= 5,
  };

  return (Object.keys(earnedAfter) as AchievementId[])
    .filter((id) => earnedAfter[id] && !earnedBefore[id])
    .map((id) => ({ id, label: ACHIEVEMENT_META[id].label }));
}

export function triggerConfetti() {
  if (typeof window === "undefined") return;
  import("canvas-confetti").then((module) => {
    const confetti = module.default;
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#A9C641", "#E8C15A", "#EEF2E7"],
    });
  });
}
