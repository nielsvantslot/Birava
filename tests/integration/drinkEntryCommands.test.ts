import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createDrinkEntry, deleteDrinkEntry, updateDrinkEntry } from "@/lib/commands/drinkEntryCommands";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";

const fixtures = new DrinkEntryFixtureFactory(db);

const emptyPayload = {
  drinkName: null,
  drinkType: "Beer" as const,
  venue: null,
  lat: null,
  lng: null,
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

    const stored = await db.drinkEntry.findUniqueOrThrow({
      where: { id: result.id! },
      include: { venue: true },
    });
    expect(stored.userId).toBe(user.id);
    expect(stored.drinkName).toBe("Westmalle Tripel");
    expect(stored.venue?.name).toBe("Café Gollem");
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
});

describe("createDrinkEntry venue resolution", () => {
  it("reuses the same Venue for a repeat visit with matching name and coordinates", async () => {
    const user = await fixtures.createUser();
    const base = { ...emptyPayload, venue: "Café Gollem", lat: 52.3648, lng: 4.889 };

    const first = await createDrinkEntry(user.id, base, { username: user.username, avatarUrl: user.avatarUrl });
    const second = await createDrinkEntry(user.id, base, { username: user.username, avatarUrl: user.avatarUrl });

    const [entry1, entry2] = await Promise.all([
      db.drinkEntry.findUniqueOrThrow({ where: { id: first.id! } }),
      db.drinkEntry.findUniqueOrThrow({ where: { id: second.id! } }),
    ]);
    expect(entry1.venueId).not.toBeNull();
    expect(entry2.venueId).toBe(entry1.venueId);

    const venueCount = await db.venue.count({ where: { name: "Café Gollem" } });
    expect(venueCount).toBe(1);
  });

  it("creates separate Venues for the same name at very different coordinates", async () => {
    const user = await fixtures.createUser();

    const first = await createDrinkEntry(
      user.id,
      { ...emptyPayload, venue: "Café Gollem", lat: 52.3648, lng: 4.889 },
      { username: user.username, avatarUrl: user.avatarUrl }
    );
    const second = await createDrinkEntry(
      user.id,
      { ...emptyPayload, venue: "Café Gollem", lat: 40.7128, lng: -74.006 }, // a different city entirely
      { username: user.username, avatarUrl: user.avatarUrl }
    );

    const [entry1, entry2] = await Promise.all([
      db.drinkEntry.findUniqueOrThrow({ where: { id: first.id! } }),
      db.drinkEntry.findUniqueOrThrow({ where: { id: second.id! } }),
    ]);
    expect(entry1.venueId).not.toBe(entry2.venueId);
  });

  it("matches an existing Venue by name alone when the new check-in has no coordinates, and backfills its coordinates", async () => {
    const user = await fixtures.createUser();

    const first = await createDrinkEntry(
      user.id,
      { ...emptyPayload, venue: "Café Gollem", lat: 52.3648, lng: 4.889 },
      { username: user.username, avatarUrl: user.avatarUrl }
    );
    const second = await createDrinkEntry(
      user.id,
      { ...emptyPayload, venue: "café gollem" }, // no GPS this time, different casing
      { username: user.username, avatarUrl: user.avatarUrl }
    );

    const entry1 = await db.drinkEntry.findUniqueOrThrow({ where: { id: first.id! } });
    const entry2 = await db.drinkEntry.findUniqueOrThrow({ where: { id: second.id! } });
    expect(entry2.venueId).toBe(entry1.venueId);
  });

  it("backfills a name-only Venue's coordinates once a later check-in provides them", async () => {
    const user = await fixtures.createUser();

    const first = await createDrinkEntry(
      user.id,
      { ...emptyPayload, venue: "New Spot" }, // no GPS
      { username: user.username, avatarUrl: user.avatarUrl }
    );
    await createDrinkEntry(
      user.id,
      { ...emptyPayload, venue: "New Spot", lat: 52.37, lng: 4.9 },
      { username: user.username, avatarUrl: user.avatarUrl }
    );

    const entry1 = await db.drinkEntry.findUniqueOrThrow({ where: { id: first.id! } });
    const venue = await db.venue.findUniqueOrThrow({ where: { id: entry1.venueId! } });
    expect(venue.lat).not.toBeNull();
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
