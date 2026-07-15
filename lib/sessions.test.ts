import { describe, expect, it } from "vitest";
import { activeWeeks, formatPace, formatSessionDuration, groupIntoSessions, sessionMinutes, sessionTitle, SESSION_GAP_MS } from "./sessions";
import type { DrinkEntry } from "./types";

let idCounter = 0;

function entry(overrides: Partial<DrinkEntry> & { created_at: string }): DrinkEntry {
  idCounter += 1;
  return {
    id: overrides.id ?? `entry-${idCounter}`,
    user_id: overrides.user_id ?? "user-1",
    group_id: null,
    drink_name: null,
    brewery: null,
    style: null,
    drink_type: "Beer",
    amount: 1,
    rating: null,
    venue: null,
    lat: null,
    lng: null,
    notes: null,
    photo_url: null,
    photo_lqip: null,
    ...overrides,
  };
}

describe("groupIntoSessions", () => {
  it("groups check-ins from the same user within the 4-hour gap into one session", () => {
    const sessions = groupIntoSessions([
      entry({ created_at: "2026-01-01T20:00:00.000Z" }),
      entry({ created_at: "2026-01-01T21:30:00.000Z" }),
      entry({ created_at: "2026-01-01T22:00:00.000Z" }),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].checkins).toHaveLength(3);
  });

  it("splits into separate sessions once the gap exceeds 4 hours", () => {
    const sessions = groupIntoSessions([
      entry({ created_at: "2026-01-01T20:00:00.000Z" }),
      entry({ created_at: new Date(new Date("2026-01-01T20:00:00.000Z").getTime() + SESSION_GAP_MS + 1000).toISOString() }),
    ]);

    expect(sessions).toHaveLength(2);
  });

  it("keeps different users' check-ins in separate sessions even at the same time", () => {
    const sessions = groupIntoSessions([
      entry({ user_id: "user-1", created_at: "2026-01-01T20:00:00.000Z" }),
      entry({ user_id: "user-2", created_at: "2026-01-01T20:00:00.000Z" }),
    ]);

    expect(sessions).toHaveLength(2);
    expect(new Set(sessions.map((s) => s.userId))).toEqual(new Set(["user-1", "user-2"]));
  });

  it("collects distinct venues and drink types in first-seen order", () => {
    const [session] = groupIntoSessions([
      entry({ created_at: "2026-01-01T20:00:00.000Z", venue: "The Local Taphouse", drink_type: "Beer" }),
      entry({ created_at: "2026-01-01T20:30:00.000Z", venue: "Café Gollem", drink_type: "Wine" }),
      entry({ created_at: "2026-01-01T21:00:00.000Z", venue: "The Local Taphouse", drink_type: "Beer" }),
    ]);

    expect(session.venues).toEqual(["The Local Taphouse", "Café Gollem"]);
    expect(session.types).toEqual(["Beer", "Wine"]);
  });

  it("orders sessions newest-first across users", () => {
    const sessions = groupIntoSessions([
      entry({ user_id: "user-1", created_at: "2026-01-01T10:00:00.000Z" }),
      entry({ user_id: "user-2", created_at: "2026-01-02T10:00:00.000Z" }),
    ]);

    expect(sessions[0].userId).toBe("user-2");
    expect(sessions[1].userId).toBe("user-1");
  });
});

describe("sessionMinutes / formatSessionDuration", () => {
  it("is zero for a lone check-in", () => {
    const [session] = groupIntoSessions([entry({ created_at: "2026-01-01T20:00:00.000Z" })]);
    expect(sessionMinutes(session)).toBe(0);
    expect(formatSessionDuration(0)).toBe("0m");
  });

  it("formats hours and minutes", () => {
    expect(formatSessionDuration(45)).toBe("45m");
    expect(formatSessionDuration(120)).toBe("2h");
    expect(formatSessionDuration(200)).toBe("3h 20m");
  });
});

describe("formatPace", () => {
  it("formats sub-minute paces in seconds instead of rounding down to 0m", () => {
    expect(formatPace(45)).toBe("45s");
    expect(formatPace(0)).toBe("0s");
  });

  it("formats minute-scale paces, keeping seconds when non-zero", () => {
    expect(formatPace(60)).toBe("1m");
    expect(formatPace(200)).toBe("3m 20s");
  });

  it("formats hour-scale paces without seconds", () => {
    expect(formatPace(3600)).toBe("1h");
    expect(formatPace(3900)).toBe("1h 5m");
    expect(formatPace(3630)).toBe("1h");
  });
});

describe("sessionTitle", () => {
  it("titles a lone check-in by its drink name, falling back to type", () => {
    const [named] = groupIntoSessions([entry({ created_at: "2026-01-01T20:00:00.000Z", drink_name: "Westmalle Tripel" })]);
    expect(sessionTitle(named, "Europe/Amsterdam")).toBe("Westmalle Tripel");

    const [unnamed] = groupIntoSessions([entry({ created_at: "2026-01-01T20:00:00.000Z", drink_name: null, drink_type: "Wine" })]);
    expect(sessionTitle(unnamed, "Europe/Amsterdam")).toBe("Wine");
  });

  it("titles a multi check-in session by local time of day", () => {
    const [session] = groupIntoSessions([
      // 20:00 UTC is 21:00 or 22:00 in Amsterdam depending on DST — either way, evening.
      entry({ created_at: "2026-01-01T20:00:00.000Z" }),
      entry({ created_at: "2026-01-01T20:30:00.000Z" }),
    ]);
    expect(sessionTitle(session, "Europe/Amsterdam")).toBe("Evening session");
  });
});

describe("activeWeeks", () => {
  const tz = "UTC";

  it("is all-zero with no sessions", () => {
    expect(activeWeeks([], tz)).toEqual({ current: 0, best: 0, strip: Array(12).fill(false) });
  });

  it("counts a single session as one active week with a current run of one", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const sessions = groupIntoSessions([entry({ created_at: now.toISOString() })]);
    const result = activeWeeks(sessions, tz, now);
    expect(result.current).toBe(1);
    expect(result.best).toBe(1);
  });

  it("survives a single rest week but ends the run after two consecutive rest weeks", () => {
    const now = new Date("2026-03-01T12:00:00.000Z");
    const oneRestWeekAgo = groupIntoSessions([
      entry({ created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 * 2).toISOString() }), // 2 weeks back — one week skipped
      entry({ created_at: now.toISOString() }),
    ]);
    expect(activeWeeks(oneRestWeekAgo, tz, now).current).toBeGreaterThanOrEqual(1);

    const twoRestWeeksAgo = groupIntoSessions([
      entry({ created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 * 3).toISOString() }), // 3 weeks back — two weeks skipped
    ]);
    expect(activeWeeks(twoRestWeeksAgo, tz, now).current).toBe(0);
  });
});
