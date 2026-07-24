import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createDrinkEntry, deleteDrinkEntry, updateDrinkEntry } from "@/lib/commands/drinkEntryCommands";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";

const fixtures = new DrinkEntryFixtureFactory(db);

const emptyPayload = {
  drinkName: null,
  drinkType: "Beer",
  venue: null,
  lat: null,
  lng: null,
  notes: null,
  photoUrl: null,
  photoLqip: null,
};

describe("createDrinkEntry", () => {
  it("persists a new check-in for the given user", async () => {
    const user = await fixtures.createUser();

    const result = await createDrinkEntry(
      user.id,
      { ...emptyPayload, drinkName: "Westmalle Tripel", venue: "Café Gollem" },
      { username: user.username, avatarUrl: user.avatarUrl }
    );

    expect(result.error).toBeUndefined();
    expect(result.id).toBeTruthy();

    const stored = await db.drinkEntry.findUniqueOrThrow({ where: { id: result.id! } });
    expect(stored.userId).toBe(user.id);
    expect(stored.drinkName).toBe("Westmalle Tripel");
    expect(stored.venue).toBe("Café Gollem");
  });

  it("never attributes a new entry to a different user", async () => {
    const userA = await fixtures.createUser();
    const userB = await fixtures.createUser();

    const result = await createDrinkEntry(userA.id, emptyPayload, {
      username: userA.username,
      avatarUrl: userA.avatarUrl,
    });

    const entry = await db.drinkEntry.findUniqueOrThrow({ where: { id: result.id! } });
    expect(entry.userId).toBe(userA.id);
    expect(entry.userId).not.toBe(userB.id);
  });

  it("notifies crew members once per session, not once per check-in (#158)", async () => {
    const member = await fixtures.createUser();
    const crewmate = await fixtures.createUser();
    const actor = { username: member.username, avatarUrl: member.avatarUrl };

    const group = await db.group.create({
      data: { name: "Fixture Crew", inviteCode: `fixture-${randomUUID()}`, ownerId: crewmate.id },
    });
    await db.groupMember.createMany({
      data: [
        { groupId: group.id, userId: member.id },
        { groupId: group.id, userId: crewmate.id },
      ],
    });

    const first = await createDrinkEntry(member.id, emptyPayload, actor);
    const second = await createDrinkEntry(member.id, emptyPayload, actor); // same session, no gap

    const firstEntry = await db.drinkEntry.findUniqueOrThrow({ where: { id: first.id! } });
    const secondEntry = await db.drinkEntry.findUniqueOrThrow({ where: { id: second.id! } });
    expect(secondEntry.sessionId).toBe(firstEntry.sessionId); // same session, confirms the no-gate scenario

    const notifications = await db.notification.findMany({
      where: { userId: crewmate.id, type: "CREW_SESSION_START" },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].entryId).toBe(firstEntry.sessionId);
  });
});

describe("updateDrinkEntry", () => {
  it("updates the caller's own entry", async () => {
    const owner = await fixtures.createUser();
    const entry = await fixtures.createDrinkEntry(owner.id, { drinkName: "Original" });

    const result = await updateDrinkEntry(owner.id, {
      ...emptyPayload,
      id: entry.id,
      drinkName: "Updated",
      drinkType: "Wine",
      venue: "New Venue",
    });

    expect(result.error).toBeUndefined();
    const updated = await db.drinkEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(updated.drinkName).toBe("Updated");
    expect(updated.drinkType).toBe("Wine");
  });

  it("refuses to update another user's entry", async () => {
    const owner = await fixtures.createUser();
    const attacker = await fixtures.createUser();
    const entry = await fixtures.createDrinkEntry(owner.id, { drinkName: "Original" });

    const result = await updateDrinkEntry(attacker.id, {
      ...emptyPayload,
      id: entry.id,
      drinkName: "Hijacked",
    });

    expect(result.error).toBe("Check-in not found");
    const unchanged = await db.drinkEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(unchanged.drinkName).toBe("Original");
  });
});

describe("deleteDrinkEntry", () => {
  it("deletes the caller's own entry", async () => {
    const owner = await fixtures.createUser();
    const entry = await fixtures.createDrinkEntry(owner.id);

    const result = await deleteDrinkEntry(owner.id, { id: entry.id });

    expect(result.error).toBeUndefined();
    const stillThere = await db.drinkEntry.findUnique({ where: { id: entry.id } });
    expect(stillThere).toBeNull();
  });

  it("leaves another user's entry alone when the id doesn't belong to the caller", async () => {
    const owner = await fixtures.createUser();
    const attacker = await fixtures.createUser();
    const entry = await fixtures.createDrinkEntry(owner.id);

    await deleteDrinkEntry(attacker.id, { id: entry.id });

    const stillThere = await db.drinkEntry.findUnique({ where: { id: entry.id } });
    expect(stillThere).not.toBeNull();
  });
});
