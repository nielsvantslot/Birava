import { Prisma } from "@prisma/client";
import type { DrinkEntry as DrinkEntryRow } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { scoreCrew, type CrewMemberInput } from "./crews";

let idCounter = 0;

function row(overrides: Partial<DrinkEntryRow> & { userId: string; createdAt: Date }): DrinkEntryRow {
  idCounter += 1;
  return {
    id: `row-${idCounter}`,
    groupId: null,
    sessionId: `session-${idCounter}`,
    drinkName: null,
    brewery: null,
    style: null,
    drinkType: "Beer",
    amount: new Prisma.Decimal(1),
    rating: null,
    venue: null,
    lat: null,
    lng: null,
    notes: null,
    photoUrl: null,
    photoLqip: null,
    ...overrides,
  };
}

function member(overrides: Partial<CrewMemberInput> & { userId: string; joinedAt: Date }): CrewMemberInput {
  return {
    username: overrides.userId,
    avatarUrl: null,
    ...overrides,
  };
}

describe("scoreCrew", () => {
  it("scores each member only from their own join date onward", () => {
    const joinedAt = new Date("2026-02-01T00:00:00.000Z");
    const members = [member({ userId: "alice", joinedAt })];
    const rows = [
      row({ userId: "alice", createdAt: new Date("2026-01-15T00:00:00.000Z") }), // before joining — ignored
      row({ userId: "alice", createdAt: new Date("2026-02-05T00:00:00.000Z") }), // after joining — counted
    ];

    const board = scoreCrew(members, rows);
    expect(board.scores[0].sessions).toBe(1);
  });

  it("ignores rows from users who aren't crew members", () => {
    const joinedAt = new Date("2026-01-01T00:00:00.000Z");
    const members = [member({ userId: "alice", joinedAt })];
    const rows = [row({ userId: "someone-else", createdAt: new Date("2026-02-01T00:00:00.000Z") })];

    const board = scoreCrew(members, rows);
    expect(board.scores[0].sessions).toBe(0);
    expect(board.recentSessions).toHaveLength(0);
  });

  it("counts distinct venues per member, and sorts by sessions then venues", () => {
    const joinedAt = new Date("2026-01-01T00:00:00.000Z");
    const members = [member({ userId: "alice", joinedAt }), member({ userId: "bob", joinedAt })];
    const rows = [
      // alice: 1 session, 2 venues
      row({ userId: "alice", createdAt: new Date("2026-02-01T18:00:00.000Z"), venue: "Taphouse" }),
      row({ userId: "alice", createdAt: new Date("2026-02-01T19:00:00.000Z"), venue: "Gollem" }),
      // bob: 2 sessions (>4h apart), 1 venue
      row({ userId: "bob", createdAt: new Date("2026-02-01T08:00:00.000Z"), venue: "Taphouse" }),
      row({ userId: "bob", createdAt: new Date("2026-02-02T08:00:00.000Z"), venue: "Taphouse" }),
    ];

    const board = scoreCrew(members, rows);
    // bob has more sessions (2 vs 1), so ranks first despite fewer venues.
    expect(board.scores[0].userId).toBe("bob");
    expect(board.scores[0].sessions).toBe(2);
    expect(board.scores[1].userId).toBe("alice");
    expect(board.scores[1].venues).toBe(2);
  });

  it("returns an empty board for a crew with no members", () => {
    expect(scoreCrew([], [])).toEqual({ scores: [], recentSessions: [] });
  });
});
