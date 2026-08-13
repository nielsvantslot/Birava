import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPECTED_GAP_MS,
  MAX_EXPECTED_GAP_MS,
  MIN_EXPECTED_GAP_MS,
  OVERDUE_BUFFER_MS,
  dueSlotsForElapsed,
  expectedGapMs,
  maxRemindersForEngagement,
  medianGapMs,
} from "./sessionReminderAlgorithm";

describe("medianGapMs", () => {
  it("returns null for no gaps", () => {
    expect(medianGapMs([])).toBeNull();
  });

  it("returns the middle value for an odd-length list", () => {
    expect(medianGapMs([10, 30, 20])).toBe(20);
  });

  it("averages the two middle values for an even-length list", () => {
    expect(medianGapMs([10, 40, 20, 30])).toBe(25);
  });
});

describe("expectedGapMs", () => {
  it("falls back to the default when there's no history at all", () => {
    expect(expectedGapMs([], [])).toBe(DEFAULT_EXPECTED_GAP_MS);
  });

  it("prefers this session's own gaps over historical ones", () => {
    expect(expectedGapMs([45 * 60 * 1000], [100 * 60 * 1000])).toBe(45 * 60 * 1000);
  });

  it("falls back to historical gaps when this session has none yet", () => {
    expect(expectedGapMs([], [45 * 60 * 1000])).toBe(45 * 60 * 1000);
  });

  it("clamps a very fast pace to the floor", () => {
    expect(expectedGapMs([5 * 60 * 1000], [])).toBe(MIN_EXPECTED_GAP_MS);
  });

  it("clamps a very sparse pace to the ceiling", () => {
    expect(expectedGapMs([5 * 60 * 60 * 1000], [])).toBe(MAX_EXPECTED_GAP_MS);
  });
});

describe("dueSlotsForElapsed", () => {
  const gapMs = 60 * 60 * 1000; // 60min expected gap -> overdue at 75min

  it("is 0 before the overdue buffer past the expected gap", () => {
    expect(dueSlotsForElapsed(60 * 60 * 1000, gapMs)).toBe(0);
    expect(dueSlotsForElapsed(74 * 60 * 1000, gapMs)).toBe(0);
  });

  it("reaches slot 1 right at gap + buffer (matches the 60min/1h15 example)", () => {
    expect(dueSlotsForElapsed(75 * 60 * 1000, gapMs)).toBe(1);
  });

  it("reaches further slots one full gap apart, not an escalating multiplier", () => {
    expect(dueSlotsForElapsed(135 * 60 * 1000, gapMs)).toBe(2); // +60min after slot 1
    expect(dueSlotsForElapsed(195 * 60 * 1000, gapMs)).toBe(3); // +60min after slot 2
  });

  it("scales with a different expected gap", () => {
    const fastGapMs = 30 * 60 * 1000;
    expect(dueSlotsForElapsed(30 * 60 * 1000 + OVERDUE_BUFFER_MS, fastGapMs)).toBe(1);
  });
});

describe("maxRemindersForEngagement", () => {
  it("gives a cold-start user the benefit of the doubt", () => {
    expect(maxRemindersForEngagement(0, 0)).toBe(2);
    expect(maxRemindersForEngagement(1, 2)).toBe(2);
  });

  it("caps a consistently-unresponsive user at today's single reminder", () => {
    expect(maxRemindersForEngagement(0, 10)).toBe(1);
  });

  it("gives a low-but-nonzero responder a middle allowance", () => {
    expect(maxRemindersForEngagement(1, 10)).toBe(2);
  });

  it("gives a consistently-responsive user the full allowance", () => {
    expect(maxRemindersForEngagement(5, 10)).toBe(3);
  });
});
