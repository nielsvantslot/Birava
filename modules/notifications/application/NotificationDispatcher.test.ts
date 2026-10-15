import { describe, expect, it } from "vitest";
import { InMemoryNotificationRepository } from "@/tests/fakes/InMemoryNotificationRepository";
import type { IPushSender, PushPayload } from "@/modules/notifications/domain/IPushSender";
import type { NotificationEvent } from "@/modules/notifications/domain/NotificationEvent";
import { NotificationDispatcher } from "./NotificationDispatcher";

class RecordingPushSender implements IPushSender {
  readonly sent: { userId: string; payload: PushPayload }[] = [];
  async send(userId: string, payload: PushPayload): Promise<void> {
    this.sent.push({ userId, payload });
  }
}

const cheer = (userId: string, overrides: Partial<NotificationEvent> = {}): NotificationEvent => ({
  userId,
  type: "CHEER",
  actorId: "actor",
  actorUsername: "sarah",
  entryId: "session-1",
  ...overrides,
});

function setup() {
  const notifications = new InMemoryNotificationRepository();
  const push = new RecordingPushSender();
  return { notifications, push, dispatcher: new NotificationDispatcher(notifications, push) };
}

describe("NotificationDispatcher", () => {
  it("writes every event and pushes to each recipient", async () => {
    const { notifications, push, dispatcher } = setup();

    await dispatcher.dispatch([cheer("alice"), cheer("bob")]);

    expect(notifications.rows.map((r) => r.userId)).toEqual(["alice", "bob"]);
    expect(push.sent.map((s) => s.userId)).toEqual(["alice", "bob"]);
    expect(push.sent[0]?.payload).toMatchObject({ title: "Birava", body: expect.stringContaining("sarah") });
  });

  it("still writes the in-app row but sends no push for a category the recipient turned off", async () => {
    const { notifications, push, dispatcher } = setup();
    notifications.disabled.set("alice", new Set(["notifyCheer"]));

    await dispatcher.dispatch([cheer("alice"), cheer("bob")]);

    expect(notifications.rows.map((r) => r.userId)).toEqual(["alice", "bob"]);
    expect(push.sent.map((s) => s.userId)).toEqual(["bob"]);
  });

  it("treats a comment as the cheers category, and a follow and a session start as the following category", async () => {
    const { notifications, push, dispatcher } = setup();
    notifications.disabled.set("alice", new Set(["notifyCheer", "notifyFollowing"]));

    await dispatcher.dispatch([
      cheer("alice", { type: "COMMENT" }),
      cheer("alice", { type: "FOLLOW" }),
      cheer("alice", { type: "SESSION_START" }),
      cheer("alice", { type: "ACHIEVEMENT", achievementLabel: "Range" }),
    ]);

    expect(push.sent.map((s) => s.userId)).toEqual(["alice"]);
    expect(notifications.rows).toHaveLength(4);
  });

  it("isolates a stale recipient: one bad row does not drop everyone else's notification or push", async () => {
    const { notifications, push, dispatcher } = setup();
    notifications.userIdsThatFailToInsert.add("deleted-user");

    await dispatcher.dispatch([cheer("alice"), cheer("deleted-user"), cheer("bob")]);

    expect(notifications.rows.map((r) => r.userId)).toEqual(["alice", "bob"]);
    expect(push.sent.map((s) => s.userId).sort()).toEqual(["alice", "bob", "deleted-user"]);
  });

  it("passes the notification id to the push so the service worker can report an open", async () => {
    const { push, dispatcher } = setup();

    await dispatcher.dispatch([cheer("alice", { id: "n-1", type: "SESSION_REMINDER" })]);

    expect(push.sent[0]?.payload.id).toBe("n-1");
  });

  it("does nothing for an empty batch", async () => {
    const { notifications, push, dispatcher } = setup();

    await dispatcher.dispatch([]);

    expect(notifications.rows).toEqual([]);
    expect(push.sent).toEqual([]);
  });

  it("keeps going when a push send fails, so one bad device cannot block the rest", async () => {
    const { push, dispatcher } = setup();
    const failing: IPushSender = {
      send: async (userId, payload) => {
        if (userId === "alice") throw new Error("push service down");
        await push.send(userId, payload);
      },
    };

    await new NotificationDispatcher(new InMemoryNotificationRepository(), failing).dispatch([cheer("alice"), cheer("bob")]);

    expect(push.sent.map((s) => s.userId)).toEqual(["bob"]);
  });
});
