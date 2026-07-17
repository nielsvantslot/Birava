import { describe, expect, it } from "vitest";
import type { Notification as NotificationRow } from "@prisma/client";
import { NotificationMapper } from "./notificationMapper";

function row(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: "notif-1",
    userId: "user-1",
    type: "FOLLOW",
    actorId: "actor-1",
    actorUsername: "sanne_b",
    actorAvatarUrl: "https://blob.example/avatars/actor-1/photo.webp",
    entryId: null,
    groupId: null,
    groupName: null,
    achievementLabel: null,
    readAt: null,
    createdAt: new Date("2026-07-01T12:00:00Z"),
    ...overrides,
  } as NotificationRow;
}

describe("NotificationMapper.toDTO", () => {
  it("passes actorId through — the render side needs it to build the avatar proxy URL (avatarSrc), since actorAvatarUrl is a stale private-blob snapshot that can't be rendered directly", () => {
    const dto = NotificationMapper.toDTO(row());
    expect(dto.actorId).toBe("actor-1");
  });

  it("carries a null actorId through for actor-less notification types (e.g. ACHIEVEMENT)", () => {
    const dto = NotificationMapper.toDTO(
      row({ type: "ACHIEVEMENT", actorId: null, actorUsername: null, actorAvatarUrl: null, achievementLabel: "Local Legend" })
    );
    expect(dto.actorId).toBeNull();
    expect(dto.message).toBe("You earned Local Legend");
  });

  it("maps read state from readAt", () => {
    expect(NotificationMapper.toDTO(row({ readAt: null })).read).toBe(false);
    expect(NotificationMapper.toDTO(row({ readAt: new Date() })).read).toBe(true);
  });
});
