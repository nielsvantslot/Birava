import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getDrinkEntryForUser } from "@/lib/queries/drinkEntryQueries";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";

const fixtures = new DrinkEntryFixtureFactory(db);

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
