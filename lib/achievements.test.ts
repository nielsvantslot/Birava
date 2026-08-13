import { describe, expect, it } from "vitest";
import { computeAchievements, newlyEarnedAchievements } from "./achievements";
import type { DrinkEntry } from "./types";

let idCounter = 0;

function entry(overrides: Partial<DrinkEntry> & { created_at: string }): DrinkEntry {
  idCounter += 1;
  return {
    id: overrides.id ?? `entry-${idCounter}`,
    user_id: "user-1",
    session_id: overrides.session_id ?? `session-${idCounter}`,
    drink_name: null,
    drink_type: "Beer",
    venue: null,
    lat: null,
    lng: null,
    photo_url: null,
    photo_lqip: null,
    ...overrides,
  };
}

function byId(entries: ReturnType<typeof computeAchievements>, id: string) {
  const found = entries.find((a) => a.id === id);
  if (!found) throw new Error(`No achievement with id ${id}`);
  return found;
}

describe("computeAchievements", () => {
  it("has nothing earned with no history", () => {
    const achievements = computeAchievements([], "UTC");
    expect(achievements.every((a) => !a.earned)).toBe(true);
  });

  it("earns First Round on the very first session", () => {
    const achievements = computeAchievements([entry({ created_at: "2026-01-01T12:00:00.000Z" })], "UTC");
    expect(byId(achievements, "first_round").earned).toBe(true);
  });

  it("earns Range only once all 4 drink types have been logged", () => {
    const threeTypes = computeAchievements(
      [
        entry({ created_at: "2026-01-01T12:00:00.000Z", drink_type: "Beer" }),
        entry({ created_at: "2026-01-01T12:00:00.000Z", drink_type: "Wine" }),
        entry({ created_at: "2026-01-01T12:00:00.000Z", drink_type: "Cocktail" }),
      ],
      "UTC"
    );
    expect(byId(threeTypes, "range").earned).toBe(false);
    expect(byId(threeTypes, "range").progressText).toBe("3 of 4 types");

    const allFour = computeAchievements(
      [
        entry({ created_at: "2026-01-01T12:00:00.000Z", drink_type: "Beer" }),
        entry({ created_at: "2026-01-01T12:00:00.000Z", drink_type: "Wine" }),
        entry({ created_at: "2026-01-01T12:00:00.000Z", drink_type: "Cocktail" }),
        entry({ created_at: "2026-01-01T12:00:00.000Z", drink_type: "Other" }),
      ],
      "UTC"
    );
    expect(byId(allFour, "range").earned).toBe(true);
  });

  it("never counts drink volume — only distinct venues/weeks, never a raw count of check-ins", () => {
    // 50 check-ins, all the same venue, same week — nothing here should
    // read as "more drinking = more progress" on any badge.
    const manyEntries = Array.from({ length: 50 }, (_, i) =>
      entry({ created_at: `2026-01-0${(i % 6) + 1}T12:00:00.000Z`, venue: "The Local Taphouse" })
    );
    const achievements = computeAchievements(manyEntries, "UTC");
    expect(byId(achievements, "cartographer").progress).toBe(1); // one distinct venue, not 50
  });

  it("earns Regular by returning to the same venue across 5 distinct weeks", () => {
    const fiveWeeks = [
      entry({ created_at: "2026-01-05T12:00:00.000Z", venue: "Taphouse" }),
      entry({ created_at: "2026-01-12T12:00:00.000Z", venue: "Taphouse" }),
      entry({ created_at: "2026-01-19T12:00:00.000Z", venue: "Taphouse" }),
      entry({ created_at: "2026-01-26T12:00:00.000Z", venue: "Taphouse" }),
      entry({ created_at: "2026-02-02T12:00:00.000Z", venue: "Taphouse" }),
    ];
    expect(byId(computeAchievements(fiveWeeks, "UTC"), "regular").earned).toBe(true);
  });
});

function ids(achievements: ReturnType<typeof newlyEarnedAchievements>): string[] {
  return achievements.map((a) => a.id);
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

// newlyEarnedAchievements is the check-in write path's diff — it must agree
// with computeAchievements' before/after result exactly, since it's a
// cheaper (incremental) way of computing the same thing, not a different rule.
describe("newlyEarnedAchievements", () => {
  it("earns First Round on the very first check-in, never again after", () => {
    const first = entry({ created_at: "2026-01-01T12:00:00.000Z" });
    expect(ids(newlyEarnedAchievements([], first, "UTC"))).toContain("first_round");

    const second = entry({ created_at: "2026-01-02T12:00:00.000Z" });
    expect(ids(newlyEarnedAchievements([first], second, "UTC"))).not.toContain("first_round");
  });

  it("earns Range only when the new entry supplies the 4th missing type", () => {
    const threeTypes = [
      entry({ created_at: "2026-01-01T12:00:00.000Z", drink_type: "Beer" }),
      entry({ created_at: "2026-01-01T12:00:00.000Z", drink_type: "Wine" }),
      entry({ created_at: "2026-01-01T12:00:00.000Z", drink_type: "Cocktail" }),
    ];
    const fourthType = entry({ created_at: "2026-01-02T12:00:00.000Z", drink_type: "Other" });
    expect(ids(newlyEarnedAchievements(threeTypes, fourthType, "UTC"))).toContain("range");

    const anotherThirdType = entry({ created_at: "2026-01-02T12:00:00.000Z", drink_type: "Cocktail" });
    expect(ids(newlyEarnedAchievements(threeTypes, anotherThirdType, "UTC"))).not.toContain("range");

    const repeatAfterAllFour = entry({ created_at: "2026-01-03T12:00:00.000Z", drink_type: "Beer" });
    expect(ids(newlyEarnedAchievements([...threeTypes, fourthType], repeatAfterAllFour, "UTC"))).not.toContain(
      "range"
    );
  });

  it("earns Cartographer on the 25th distinct venue, not on a repeat visit after", () => {
    const twentyFourVenues = Array.from({ length: 24 }, (_, i) =>
      entry({ created_at: "2026-01-01T12:00:00.000Z", venue: `Venue ${i + 1}` })
    );
    const twentyFifthVenue = entry({ created_at: "2026-01-02T12:00:00.000Z", venue: "Venue 25" });
    expect(ids(newlyEarnedAchievements(twentyFourVenues, twentyFifthVenue, "UTC"))).toContain("cartographer");

    const repeatVenue = entry({ created_at: "2026-01-02T12:00:00.000Z", venue: "Venue 1" });
    expect(ids(newlyEarnedAchievements(twentyFourVenues, repeatVenue, "UTC"))).not.toContain("cartographer");

    const afterTwentyFive = [...twentyFourVenues, twentyFifthVenue];
    const anotherRepeat = entry({ created_at: "2026-01-03T12:00:00.000Z", venue: "Venue 2" });
    expect(ids(newlyEarnedAchievements(afterTwentyFive, anotherRepeat, "UTC"))).not.toContain("cartographer");
  });

  it("earns Regular on the 5th distinct week at the same venue", () => {
    const fourWeeks = [
      entry({ created_at: "2026-01-05T12:00:00.000Z", venue: "Taphouse" }),
      entry({ created_at: "2026-01-12T12:00:00.000Z", venue: "Taphouse" }),
      entry({ created_at: "2026-01-19T12:00:00.000Z", venue: "Taphouse" }),
      entry({ created_at: "2026-01-26T12:00:00.000Z", venue: "Taphouse" }),
    ];
    const fifthWeek = entry({ created_at: "2026-02-02T12:00:00.000Z", venue: "Taphouse" });
    expect(ids(newlyEarnedAchievements(fourWeeks, fifthWeek, "UTC"))).toContain("regular");

    const sameWeekAgain = entry({ created_at: "2026-01-05T18:00:00.000Z", venue: "Taphouse" });
    expect(ids(newlyEarnedAchievements(fourWeeks, sameWeekAgain, "UTC"))).not.toContain("regular");
  });

  it("earns Local Legend on the 3rd check-in at one venue within the 90-day window", () => {
    const twoRecentVisits = [
      entry({ created_at: daysAgo(10), venue: "Pub" }),
      entry({ created_at: daysAgo(5), venue: "Pub" }),
    ];
    const thirdRecentVisit = entry({ created_at: daysAgo(1), venue: "Pub" });
    expect(ids(newlyEarnedAchievements(twoRecentVisits, thirdRecentVisit, "UTC"))).toContain("local_legend");
  });

  it("doesn't count visits older than the 90-day window toward Local Legend", () => {
    const oldVisits = [
      entry({ created_at: daysAgo(120), venue: "OldPub" }),
      entry({ created_at: daysAgo(110), venue: "OldPub" }),
    ];
    const recentVisitSameVenue = entry({ created_at: daysAgo(1), venue: "OldPub" });
    // Only 1 of the 3 total visits is inside the 90-day window, so this
    // shouldn't newly earn Local Legend despite 3 lifetime visits to OldPub.
    expect(ids(newlyEarnedAchievements(oldVisits, recentVisitSameVenue, "UTC"))).not.toContain("local_legend");
  });

  it("returns nothing when the new entry crosses no threshold", () => {
    const history = [
      entry({ created_at: "2026-01-01T12:00:00.000Z", drink_type: "Beer", venue: "Taphouse" }),
    ];
    const ordinaryCheckin = entry({ created_at: "2026-01-02T12:00:00.000Z", drink_type: "Beer", venue: "Taphouse" });
    expect(newlyEarnedAchievements(history, ordinaryCheckin, "UTC")).toEqual([]);
  });
});
