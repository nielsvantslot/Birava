import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getNotificationPreferences } from "@/lib/queries/notificationQueries";
import { updateNotificationPreference } from "@/lib/commands/notificationCommands";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";

const fixtures = new DrinkEntryFixtureFactory(db);

describe("notification preferences", () => {
  it("defaults every category to enabled for a user who never touched settings", async () => {
    const user = await fixtures.createUser();

    const prefs = await getNotificationPreferences(user.id);

    expect(prefs).toEqual({
      notifyCrewCheckin: true,
      notifyCheer: true,
      notifyCrewActivity: true,
      notifyAchievement: true,
      notifyFollowing: true,
      notifySessionReminder: true,
    });
  });

  it("persists a single toggle without a row for a category that was never touched", async () => {
    const user = await fixtures.createUser();

    await updateNotificationPreference(user.id, { key: "notifyCheer", enabled: false });

    const prefs = await getNotificationPreferences(user.id);
    expect(prefs.notifyCheer).toBe(false);
    expect(prefs.notifyCrewCheckin).toBe(true);

    const rows = await db.notificationPreference.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: "notifyCheer", enabled: false });
  });

  it("re-enabling a category updates the existing row rather than creating a duplicate", async () => {
    const user = await fixtures.createUser();

    await updateNotificationPreference(user.id, { key: "notifyAchievement", enabled: false });
    await updateNotificationPreference(user.id, { key: "notifyAchievement", enabled: true });

    const prefs = await getNotificationPreferences(user.id);
    expect(prefs.notifyAchievement).toBe(true);

    const rows = await db.notificationPreference.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: "notifyAchievement", enabled: true });
  });

  it("keeps preferences isolated per user", async () => {
    const userA = await fixtures.createUser();
    const userB = await fixtures.createUser();

    await updateNotificationPreference(userA.id, { key: "notifyFollowing", enabled: false });

    const prefsA = await getNotificationPreferences(userA.id);
    const prefsB = await getNotificationPreferences(userB.id);
    expect(prefsA.notifyFollowing).toBe(false);
    expect(prefsB.notifyFollowing).toBe(true);
  });
});
