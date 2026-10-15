import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getMyFeedSessions, getMyDrinkHistory } from "@/modules/checkins/server/drinkReads";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";
import { loginAs } from "./support/loginAs";

/**
 * The phase 3 performance gate: the dashboard's reads against a large, seeded
 * account must stay inside a budget, so an N+1 or an accidental full scan
 * fails CI instead of shipping. The account is "a heavy user" by design: about
 * 3 years of nights out, 600 sessions and 3,000 check-ins, far past what a
 * real account has today, so the budget has headroom for growth but not for a
 * regression of the kind docs/audit/birava-perf-audit-2026-07-10.md found.
 *
 * Budgets are 5 to 10 times what was measured (see BUDGET_NOTE), room for a
 * slow runner but not for an order-of-magnitude regression. Raise one only
 * with a reason, in the same PR as the change that needs it.
 */

const SESSIONS = 600;
const DRINKS_PER_SESSION = 5;
const RUNS = 25;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** p95 budgets in milliseconds. */
const BUDGET_MS = {
  /** One page of the dashboard feed: sessions, cheers and comment counts. */
  feedPage: 120,
  /** The full-history read behind stats, achievements and the own profile. */
  fullHistory: 500,
};
const BUDGET_NOTE = "about 11ms and 76ms measured locally on 2026-10-15; a CI runner is 2 to 3 times slower";

async function seedHeavyUser() {
  const fixtures = new DrinkEntryFixtureFactory(db);
  const user = await fixtures.createUser();
  const types = ["Beer", "Wine", "Cocktail", "Other"] as const;
  const venues = await Promise.all(
    Array.from({ length: 40 }, (_, i) => db.venue.create({ data: { name: `Venue ${i}`, lat: 52 + i / 100, lng: 4 + i / 100 }, select: { id: true } }))
  );

  const now = Date.now();
  const sessions: { id: string; userId: string; startedAt: Date; endedAt: Date }[] = [];
  const entries: {
    id: string;
    userId: string;
    sessionId: string;
    drinkName: string;
    drinkType: (typeof types)[number];
    venueId: string;
    createdAt: Date;
  }[] = [];

  for (let s = 0; s < SESSIONS; s++) {
    const sessionId = randomUUID();
    // One night every ~1.8 days over three years, newest last.
    const start = now - (SESSIONS - s) * 1.8 * DAY;
    for (let d = 0; d < DRINKS_PER_SESSION; d++) {
      entries.push({
        id: randomUUID(),
        userId: user.id,
        sessionId,
        drinkName: `Drink ${s}-${d}`,
        drinkType: types[(s + d) % types.length]!,
        venueId: venues[(s * 3 + d) % venues.length]!.id,
        createdAt: new Date(start + d * 0.5 * HOUR),
      });
    }
    sessions.push({
      id: sessionId,
      userId: user.id,
      startedAt: new Date(start),
      endedAt: new Date(start + (DRINKS_PER_SESSION - 1) * 0.5 * HOUR),
    });
  }

  await db.drinkSession.createMany({ data: sessions });
  await db.drinkEntry.createMany({ data: entries });
  return user;
}

async function p95(work: () => Promise<unknown>): Promise<number> {
  await work(); // warm the connection and the plan cache
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    await work();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.ceil(times.length * 0.95) - 1]!;
}

describe(`performance budgets on a heavy account (${SESSIONS} sessions, ${SESSIONS * DRINKS_PER_SESSION} check-ins)`, () => {
  it(`keeps a dashboard feed page under ${BUDGET_MS.feedPage}ms at the 95th percentile (${BUDGET_NOTE})`, async () => {
    const user = await seedHeavyUser();
    await loginAs(user.id);

    const feed = await getMyFeedSessions({ onlyOwn: true });
    expect(feed.sessions).toHaveLength(12);
    expect(feed.nextCursor).not.toBeNull();

    const measured = await p95(() => getMyFeedSessions({ onlyOwn: true }));
    console.log(`feed page p95: ${measured.toFixed(1)}ms (budget ${BUDGET_MS.feedPage}ms)`);

    expect(measured).toBeLessThan(BUDGET_MS.feedPage);
  }, 120_000);

  it(`keeps the full-history read under ${BUDGET_MS.fullHistory}ms at the 95th percentile`, async () => {
    const user = await seedHeavyUser();
    await loginAs(user.id);

    expect(await getMyDrinkHistory()).toHaveLength(SESSIONS * DRINKS_PER_SESSION);

    const measured = await p95(() => getMyDrinkHistory());
    console.log(`full history p95: ${measured.toFixed(1)}ms (budget ${BUDGET_MS.fullHistory}ms)`);

    expect(measured).toBeLessThan(BUDGET_MS.fullHistory);
  }, 120_000);
});
