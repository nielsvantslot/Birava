import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUIET_THRESHOLD_MS,
  MAX_QUIET_THRESHOLD_MS,
  MIN_QUIET_THRESHOLD_MS,
  dueTierForElapsed,
  maxRemindersForEngagement,
  medianGapMs,
  personalizedQuietThresholdMs,
  tierBoundariesMs,
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

describe("personalizedQuietThresholdMs", () => {
  it("falls back to the default when there's no history", () => {
    expect(personalizedQuietThresholdMs(null)).toBe(DEFAULT_QUIET_THRESHOLD_MS);
  });

  it("clamps a very fast logger's median gap to the floor", () => {
    expect(personalizedQuietThresholdMs(5 * 60 * 1000)).toBe(MIN_QUIET_THRESHOLD_MS);
  });

  it("clamps a very sparse logger's median gap to the ceiling", () => {
    expect(personalizedQuietThresholdMs(5 * 60 * 60 * 1000)).toBe(MAX_QUIET_THRESHOLD_MS);
  });

  it("uses the median gap as-is when it's already within bounds", () => {
    expect(personalizedQuietThresholdMs(45 * 60 * 1000)).toBe(45 * 60 * 1000);
  });
});

describe("tierBoundariesMs", () => {
  it("builds increasing tiers off the threshold", () => {
    const [t1, t2, t3] = tierBoundariesMs(40 * 60 * 1000);
    expect(t1).toBe(40 * 60 * 1000);
    expect(t2).toBe(80 * 60 * 1000);
    expect(t3).toBe(140 * 60 * 1000);
  });

  it("caps tier 3 so it always leaves a buffer before the session's hard close", () => {
    const [, , t3] = tierBoundariesMs(MAX_QUIET_THRESHOLD_MS);
    expect(t3).toBeLessThan(4 * 60 * 60 * 1000);
  });
});

describe("dueTierForElapsed", () => {
  const tiers: [number, number, number] = [60 * 60 * 1000, 120 * 60 * 1000, 210 * 60 * 1000];

  it("is 0 before the first tier", () => {
    expect(dueTierForElapsed(30 * 60 * 1000, tiers)).toBe(0);
  });

  it("reaches each tier once elapsed time crosses its boundary", () => {
    expect(dueTierForElapsed(61 * 60 * 1000, tiers)).toBe(1);
    expect(dueTierForElapsed(121 * 60 * 1000, tiers)).toBe(2);
    expect(dueTierForElapsed(211 * 60 * 1000, tiers)).toBe(3);
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

  it("gives a consistently-responsive user the full escalation", () => {
    expect(maxRemindersForEngagement(5, 10)).toBe(3);
  });
});
