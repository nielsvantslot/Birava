import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getDrinkEntryForUser, getRecentDrinkHistoryForLegend } from "@/lib/queries/drinkEntryQueries";
import { LOCAL_LEGEND_WINDOW_MS } from "@/lib/sessions";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";

const fixtures = new DrinkEntryFixtureFactory(db);
const DAY_MS = 24 * 60 * 60 * 1000;

describe("getDrinkEntryForUser", () => {
  it("returns session_id distinct from id for a check-in that isn't its session's anchor", async () => {
    const user = await fixtures.createUser();
    const sessionId = randomUUID();
    await db.drinkSession.create({
      data: { id: sessionId, userId: user.id, startedAt: new Date(), endedAt: new Date() },
    });

    // The anchor entry shares the session's id (set at creation, as
    // assignSessionForNewEntry does in production); a second entry attached
    // to the same session does not — its own id is unrelated to sessionId.
    await db.drinkEntry.create({
      data: {
        id: sessionId,
        userId: user.id,
        sessionId,
        drinkName: "Anchor",
        drinkType: "Beer",
        createdAt: new Date(),
      },
    });
    const second = await fixtures.createDrinkEntry(user.id, { sessionId });

    const fetched = await getDrinkEntryForUser(user.id, second.id);

    expect(fetched?.id).toBe(second.id);
    expect(fetched?.session_id).toBe(sessionId);
    expect(fetched?.session_id).not.toBe(fetched?.id);
  });
});

describe("getRecentDrinkHistoryForLegend", () => {
  it("only returns check-ins inside the 90-day Local Legend window", async () => {
    const user = await fixtures.createUser();
    await fixtures.createDrinkEntry(user.id, {
      createdAt: new Date(Date.now() - (LOCAL_LEGEND_WINDOW_MS + DAY_MS)),
      venue: "Old Pub",
    });
    const recent = await fixtures.createDrinkEntry(user.id, {
      createdAt: new Date(Date.now() - DAY_MS),
      venue: "New Pub",
    });

    const history = await getRecentDrinkHistoryForLegend(user.id);

    expect(history).toHaveLength(1);
    expect(history[0].venue).toBe("New Pub");
    expect(history[0].created_at).toBe(recent.createdAt.toISOString());
  });

  it("returns nothing for a user with no recent check-ins", async () => {
    const user = await fixtures.createUser();
    await fixtures.createDrinkEntry(user.id, {
      createdAt: new Date(Date.now() - (LOCAL_LEGEND_WINDOW_MS + DAY_MS)),
      venue: "Old Pub",
    });

    const history = await getRecentDrinkHistoryForLegend(user.id);

    expect(history).toEqual([]);
  });
});
