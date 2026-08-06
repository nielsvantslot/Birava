import { DrinkEntry, DRINK_TYPES } from "@/lib/types";
import { countSessions, getLocalLegendVenue } from "@/lib/sessions";
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

export function computeAchievements(
  entries: AchievementEntry[],
  tz: string
): VarietyAchievement[] {
  const sessionCount = countSessions(entries);

  const types = new Set(entries.map((e) => e.drink_type).filter(Boolean));
  const venues = new Set(
    entries.map((e) => e.venue?.trim()).filter((v): v is string => !!v)
  );
  const legendVenue = getLocalLegendVenue(entries);

  // Regular: distinct calendar weeks per venue, best venue counts
  const weeksPerVenue = new Map<string, Set<number>>();
  for (const e of entries) {
    const venue = e.venue?.trim();
    if (!venue) continue;
    const set = weeksPerVenue.get(venue) ?? new Set<number>();
    set.add(weekIndex(new Date(e.created_at), tz));
    weeksPerVenue.set(venue, set);
  }
  let regularWeeks = 0;
  let regularVenue: string | null = null;
  for (const [venue, weeks] of weeksPerVenue) {
    if (weeks.size > regularWeeks) {
      regularWeeks = weeks.size;
      regularVenue = venue;
    }
  }

  const range = Math.min(types.size, DRINK_TYPES.length);
  const cartographer = Math.min(venues.size, 25);
  const regular = Math.min(regularWeeks, 5);

  return [
    {
      id: "first_round",
      label: "First Round",
      description: "Log your very first session.",
      icon: "glass",
      progress: Math.min(sessionCount, 1),
      goal: 1,
      earned: sessionCount >= 1,
      progressText: sessionCount >= 1 ? "Earned" : "0 of 1 sessions",
    },
    {
      id: "range",
      label: "Range",
      description: "Log all 4 drink types. Beer, wine, cocktail and other.",
      icon: "star",
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
      label: "Cartographer",
      description: "Explore 25 different venues.",
      icon: "pin",
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
      label: "Local Legend",
      description:
        "Most check-ins at one venue over 90 days. Hold it to keep the crown.",
      icon: "badge",
      progress: legendVenue ? 1 : 0,
      goal: 1,
      earned: !!legendVenue,
      progressText: legendVenue ? `Earned · ${legendVenue}` : "Not yet earned",
    },
    {
      id: "regular",
      label: "Regular",
      description: "Return to the same venue in 5 different weeks.",
      icon: "repeat",
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
