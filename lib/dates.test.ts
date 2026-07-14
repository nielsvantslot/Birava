import { describe, expect, it } from "vitest";
import {
  dayNumber,
  formatDate,
  formatTime,
  isValidTimeZone,
  localParts,
  relativeDay,
  relativeDayTime,
  timeAgo,
  weekIndex,
} from "./dates";

describe("isValidTimeZone", () => {
  it("accepts a real IANA zone and rejects a made-up one", () => {
    expect(isValidTimeZone("Europe/Amsterdam")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});

describe("localParts", () => {
  it("converts a UTC instant to the target zone's wall-clock parts", () => {
    // 23:30 UTC on Jan 1 is 00:30 on Jan 2 in Amsterdam (UTC+1 in winter).
    const parts = localParts(new Date("2026-01-01T23:30:00.000Z"), "Europe/Amsterdam");
    expect(parts).toEqual({ year: 2026, month: 1, day: 2, hour: 0, minute: 30 });
  });
});

describe("dayNumber / weekIndex", () => {
  it("gives consecutive calendar days consecutive day numbers", () => {
    const d1 = dayNumber(new Date("2026-01-01T12:00:00.000Z"), "UTC");
    const d2 = dayNumber(new Date("2026-01-02T12:00:00.000Z"), "UTC");
    expect(d2 - d1).toBe(1);
  });

  it("gives the same week index for two days in the same Mon-Sun week", () => {
    // 2026-01-05 is a Monday, 2026-01-11 is the following Sunday.
    const monday = weekIndex(new Date("2026-01-05T12:00:00.000Z"), "UTC");
    const sunday = weekIndex(new Date("2026-01-11T12:00:00.000Z"), "UTC");
    expect(monday).toBe(sunday);
  });

  it("gives consecutive week indices to consecutive weeks", () => {
    const week1 = weekIndex(new Date("2026-01-05T12:00:00.000Z"), "UTC");
    const week2 = weekIndex(new Date("2026-01-12T12:00:00.000Z"), "UTC");
    expect(week2 - week1).toBe(1);
  });
});

describe("formatTime", () => {
  it("pads to HH:MM in the target zone", () => {
    expect(formatTime(new Date("2026-06-01T08:05:00.000Z"), "UTC")).toBe("08:05");
  });
});

describe("relativeDay / relativeDayTime", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");

  it("labels today and yesterday", () => {
    expect(relativeDay(now, "UTC", now)).toBe("Today");
    expect(relativeDay(new Date("2026-06-09T12:00:00.000Z"), "UTC", now)).toBe("Yesterday");
  });

  it("labels the rest of this week by weekday name, and older dates by date", () => {
    expect(relativeDay(new Date("2026-06-07T12:00:00.000Z"), "UTC", now)).toBe("Sun");
    expect(relativeDay(new Date("2026-01-01T12:00:00.000Z"), "UTC", now)).toBe("1 Jan");
  });

  it("includes the year once the date crosses into a different calendar year", () => {
    expect(relativeDay(new Date("2025-06-01T12:00:00.000Z"), "UTC", now)).toBe("1 Jun 2025");
  });

  it("combines the day label with the time", () => {
    expect(relativeDayTime(now, "UTC", now)).toBe("Today, 12:00");
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");

  it("reports minutes and hours within the same day", () => {
    expect(timeAgo(new Date("2026-06-10T11:59:30.000Z"), "UTC", now)).toBe("just now");
    expect(timeAgo(new Date("2026-06-10T11:45:00.000Z"), "UTC", now)).toBe("15m ago");
    expect(timeAgo(new Date("2026-06-10T09:00:00.000Z"), "UTC", now)).toBe("3h ago");
  });

  it("falls back to relativeDay once it's a different calendar day", () => {
    expect(timeAgo(new Date("2026-06-09T09:00:00.000Z"), "UTC", now)).toBe("Yesterday");
  });
});

describe("formatDate", () => {
  it("formats an absolute date", () => {
    expect(formatDate(new Date("2026-06-01T12:00:00.000Z"), "UTC")).toBe("1 Jun 2026");
  });
});
