import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { renameSession } from "@/lib/commands/drinkSessionCommands";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";

const fixtures = new DrinkEntryFixtureFactory(db);

async function sessionIdFor(entryId: string): Promise<string> {
  return (await db.drinkEntry.findUniqueOrThrow({ where: { id: entryId } })).sessionId;
}

describe("renameSession", () => {
  it("sets a custom name on the caller's own session", async () => {
    const owner = await fixtures.createUser();
    const entry = await fixtures.createDrinkEntry(owner.id);
    const sessionId = await sessionIdFor(entry.id);

    const result = await renameSession(owner.id, { id: sessionId, name: "Friday kickoff" });

    expect(result.error).toBeUndefined();
    const session = await db.drinkSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.name).toBe("Friday kickoff");
  });

  it("trims whitespace", async () => {
    const owner = await fixtures.createUser();
    const entry = await fixtures.createDrinkEntry(owner.id);
    const sessionId = await sessionIdFor(entry.id);

    await renameSession(owner.id, { id: sessionId, name: "  Friday kickoff  " });

    const session = await db.drinkSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.name).toBe("Friday kickoff");
  });

  it("clears the name back to null when given an empty or whitespace-only string", async () => {
    const owner = await fixtures.createUser();
    const entry = await fixtures.createDrinkEntry(owner.id);
    const sessionId = await sessionIdFor(entry.id);
    await renameSession(owner.id, { id: sessionId, name: "Friday kickoff" });

    const result = await renameSession(owner.id, { id: sessionId, name: "   " });

    expect(result.error).toBeUndefined();
    const session = await db.drinkSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.name).toBeNull();
  });

  it("refuses a name over the length limit and leaves the existing name untouched", async () => {
    const owner = await fixtures.createUser();
    const entry = await fixtures.createDrinkEntry(owner.id);
    const sessionId = await sessionIdFor(entry.id);
    await renameSession(owner.id, { id: sessionId, name: "Original name" });

    const result = await renameSession(owner.id, { id: sessionId, name: "x".repeat(41) });

    expect(result.error).toBe("Session name is too long");
    const session = await db.drinkSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.name).toBe("Original name");
  });

  it("refuses to rename another user's session", async () => {
    const owner = await fixtures.createUser();
    const stranger = await fixtures.createUser();
    const entry = await fixtures.createDrinkEntry(owner.id);
    const sessionId = await sessionIdFor(entry.id);

    const result = await renameSession(stranger.id, { id: sessionId, name: "Hijacked" });

    expect(result.error).toBe("Session not found");
    const session = await db.drinkSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.name).toBeNull();
  });
});
