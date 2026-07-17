import { describe, expect, it } from "vitest";
import { computeAchievements } from "./achievements";
import type { DrinkEntry } from "./types";

let idCounter = 0;

function entry(overrides: Partial<DrinkEntry> & { created_at: string }): DrinkEntry {
  idCounter += 1;
  return {
    id: overrides.id ?? `entry-${idCounter}`,
    user_id: "user-1",
    drink_name: null,
    drink_type: "Beer",
    venue: null,
    lat: null,
    lng: null,
    notes: null,
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

  it("never counts drink volume — only distinct venues/notes/weeks, never a raw count of check-ins", () => {
    // 50 check-ins, all the same venue, same week, no notes — nothing here
    // should read as "more drinking = more progress" on any badge.
    const manyEntries = Array.from({ length: 50 }, (_, i) =>
      entry({ created_at: `2026-01-0${(i % 6) + 1}T12:00:00.000Z`, venue: "The Local Taphouse" })
    );
    const achievements = computeAchievements(manyEntries, "UTC");
    expect(byId(achievements, "chronicler").progress).toBe(0); // no notes were added
    expect(byId(achievements, "cartographer").progress).toBe(1); // one distinct venue, not 50
  });

  it("earns Chronicler once 20 check-ins have a note", () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      entry({ created_at: "2026-01-01T12:00:00.000Z", notes: `note ${i}` })
    );
    expect(byId(computeAchievements(entries, "UTC"), "chronicler").earned).toBe(true);
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
