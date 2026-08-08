import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { markNotificationOpened } from "@/lib/commands/notificationCommands";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";

const fixtures = new DrinkEntryFixtureFactory(db);

async function createNotification(userId: string) {
  return db.notification.create({ data: { userId, type: "SESSION_REMINDER" } });
}

describe("markNotificationOpened", () => {
  it("sets openedAt the first time", async () => {
    const user = await fixtures.createUser();
    const notification = await createNotification(user.id);

    await markNotificationOpened(notification.id, user.id);

    const row = await db.notification.findUniqueOrThrow({ where: { id: notification.id } });
    expect(row.openedAt).not.toBeNull();
  });

  it("does not overwrite an already-set openedAt", async () => {
    const user = await fixtures.createUser();
    const notification = await createNotification(user.id);
    await markNotificationOpened(notification.id, user.id);
    const firstOpen = (await db.notification.findUniqueOrThrow({ where: { id: notification.id } })).openedAt;

    await markNotificationOpened(notification.id, user.id);

    const row = await db.notification.findUniqueOrThrow({ where: { id: notification.id } });
    expect(row.openedAt).toEqual(firstOpen);
  });

  it("refuses to mark another user's notification", async () => {
    const owner = await fixtures.createUser();
    const stranger = await fixtures.createUser();
    const notification = await createNotification(owner.id);

    await markNotificationOpened(notification.id, stranger.id);

    const row = await db.notification.findUniqueOrThrow({ where: { id: notification.id } });
    expect(row.openedAt).toBeNull();
  });
});
