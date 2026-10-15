import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { DrinkEntry } from "@/lib/types";
import { groupIntoSessions } from "@/modules/sessions/domain/sessions";
import { scoreCrew, type CrewMemberInput } from "./crews";

const BASE = Date.parse("2026-03-01T00:00:00.000Z");
const QUARTER_HOUR = 15 * 60 * 1000;
const USERS = ["alice", "bob", "carol", "dave"] as const;

const at = (quarterHours: number) => new Date(BASE + quarterHours * QUARTER_HOUR);

const memberSpecs = fc.uniqueArray(
  fc.record({
    userId: fc.constantFrom(...USERS),
    joinedQuarterHours: fc.integer({ min: 0, max: 4 * 24 }),
  }),
  { selector: (m) => m.userId, maxLength: USERS.length }
);

const entrySpecs = fc.array(
  fc.record({
    userId: fc.constantFrom(...USERS, "outsider"),
    quarterHours: fc.integer({ min: 0, max: 8 * 24 }),
    venue: fc.constantFrom(null, "Bar A", "Bar B"),
  }),
  { maxLength: 40 }
);

const closedSpec = fc.option(fc.integer({ min: 4 * 24, max: 8 * 24 }), { nil: null });

type MemberSpec = { userId: string; joinedQuarterHours: number };
type EntrySpec = { userId: string; quarterHours: number; venue: string | null };

function toMembers(specs: MemberSpec[]): CrewMemberInput[] {
  return specs.map((m) => ({
    userId: m.userId,
    username: m.userId,
    avatarUrl: null,
    isDeveloper: false,
    joinedAt: at(m.joinedQuarterHours),
  }));
}

function toEntries(specs: EntrySpec[]): DrinkEntry[] {
  return specs.map((e, i) => ({
    id: `e${i}`,
    user_id: e.userId,
    session_id: `s${i}`,
    drink_name: null,
    drink_type: "Beer",
    venue: e.venue,
    lat: null,
    lng: null,
    photo_url: null,
    photo_lqip: null,
    created_at: at(e.quarterHours).toISOString(),
  }));
}

/** The since-joined rule restated independently of scoreCrew. */
function expectedFor(member: CrewMemberInput, entries: DrinkEntry[], closedAt: Date | null) {
  const cutoff = (closedAt ?? new Date()).getTime();
  const own = entries.filter(
    (e) =>
      e.user_id === member.userId &&
      Date.parse(e.created_at) >= member.joinedAt.getTime() &&
      Date.parse(e.created_at) <= cutoff
  );
  const venues = new Set(own.map((e) => e.venue?.trim()).filter((v): v is string => !!v));
  return { sessions: groupIntoSessions(own).length, drinks: own.length, venues: venues.size };
}

describe("scoreCrew properties", () => {
  it("scores each member from their own join date onward, matching an independent recomputation", () => {
    fc.assert(
      fc.property(memberSpecs, entrySpecs, closedSpec, (memberSpec, entrySpec, closed) => {
        const members = toMembers(memberSpec);
        const entries = toEntries(entrySpec);
        const closedAt = closed === null ? null : at(closed);
        const board = scoreCrew(members, entries, closedAt);

        expect(board.scores).toHaveLength(members.length);
        for (const score of board.scores) {
          const member = members.find((m) => m.userId === score.userId)!;
          const expected = expectedFor(member, entries, closedAt);
          expect({ sessions: score.sessions, drinks: score.drinks, venues: score.venues }).toEqual(expected);
        }
      })
    );
  });

  it("ranks by sessions, then by drinks since joining", () => {
    fc.assert(
      fc.property(memberSpecs, entrySpecs, (memberSpec, entrySpec) => {
        const { scores } = scoreCrew(toMembers(memberSpec), toEntries(entrySpec));
        for (let i = 1; i < scores.length; i++) {
          const a = scores[i - 1]!;
          const b = scores[i]!;
          expect(a.sessions > b.sessions || (a.sessions === b.sessions && a.drinks >= b.drinks)).toBe(true);
        }
      })
    );
  });

  it("ignores check-ins from before a member joined and from non-members", () => {
    fc.assert(
      fc.property(memberSpecs, entrySpecs, (memberSpec, entrySpec) => {
        const members = toMembers(memberSpec);
        const entries = toEntries(entrySpec);
        const joinedAt = new Map(members.map((m) => [m.userId, m.joinedAt.getTime()]));
        const countable = entries.filter((e) => {
          const joined = joinedAt.get(e.user_id);
          return joined !== undefined && Date.parse(e.created_at) >= joined;
        });
        // Dropping everything that shouldn't count changes nothing.
        expect(scoreCrew(members, countable).scores).toEqual(scoreCrew(members, entries).scores);
      })
    );
  });

  it("returns an empty board for a crew with no members", () => {
    fc.assert(
      fc.property(entrySpecs, (entrySpec) => {
        expect(scoreCrew([], toEntries(entrySpec))).toEqual({ scores: [], recentSessions: [] });
      })
    );
  });

  it("never lists more than four recent sessions, newest first", () => {
    fc.assert(
      fc.property(memberSpecs, entrySpecs, (memberSpec, entrySpec) => {
        const { recentSessions } = scoreCrew(toMembers(memberSpec), toEntries(entrySpec));
        expect(recentSessions.length).toBeLessThanOrEqual(4);
        for (let i = 1; i < recentSessions.length; i++) {
          expect(Date.parse(recentSessions[i - 1]!.end)).toBeGreaterThanOrEqual(Date.parse(recentSessions[i]!.end));
        }
      })
    );
  });

  it("lets a joining member's earlier history not win them the board", () => {
    const joined = at(100);
    const members = toMembers([{ userId: "alice", joinedQuarterHours: 100 }]);
    const history = toEntries(Array.from({ length: 10 }, (_, i) => ({ userId: "alice", quarterHours: i * 10, venue: null })));
    expect(history.every((e) => new Date(e.created_at) < joined)).toBe(true);
    expect(scoreCrew(members, history).scores[0]).toMatchObject({ sessions: 0, drinks: 0 });
  });
});
