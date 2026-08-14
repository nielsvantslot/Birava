import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { completeOnboarding } from "@/lib/commands/userCommands";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";

const fixtures = new DrinkEntryFixtureFactory(db);

describe("completeOnboarding", () => {
  it("flips hasCompletedOnboarding from its default false to true", async () => {
    const user = await fixtures.createUser();
    const before = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(before.hasCompletedOnboarding).toBe(false);

    const result = await completeOnboarding(user.id);

    expect(result.error).toBeUndefined();
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.hasCompletedOnboarding).toBe(true);
  });
});
