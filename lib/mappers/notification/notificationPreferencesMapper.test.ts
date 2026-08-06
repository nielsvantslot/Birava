import { describe, expect, it } from "vitest";
import { NotificationPreferencesMapper } from "./notificationPreferencesMapper";

describe("NotificationPreferencesMapper.toDTO", () => {
  it("defaults every category to enabled when there are no overrides", () => {
    const dto = NotificationPreferencesMapper.toDTO([]);
    expect(dto).toEqual({
      notifyCrewCheckin: true,
      notifyCheer: true,
      notifyCrewActivity: true,
      notifyAchievement: true,
      notifyFollowing: true,
      notifySessionReminder: true,
    });
  });

  it("applies a single override, leaving every other category at the default", () => {
    const dto = NotificationPreferencesMapper.toDTO([{ key: "notifyCheer", enabled: false }]);
    expect(dto.notifyCheer).toBe(false);
    expect(dto.notifyCrewCheckin).toBe(true);
    expect(dto.notifyCrewActivity).toBe(true);
    expect(dto.notifyAchievement).toBe(true);
    expect(dto.notifyFollowing).toBe(true);
    expect(dto.notifySessionReminder).toBe(true);
  });

  it("applies every override when all categories have been turned off", () => {
    const dto = NotificationPreferencesMapper.toDTO([
      { key: "notifyCrewCheckin", enabled: false },
      { key: "notifyCheer", enabled: false },
      { key: "notifyCrewActivity", enabled: false },
      { key: "notifyAchievement", enabled: false },
      { key: "notifyFollowing", enabled: false },
      { key: "notifySessionReminder", enabled: false },
    ]);
    expect(Object.values(dto).every((v) => v === false)).toBe(true);
  });

  it("ignores an unrecognized key instead of throwing", () => {
    const dto = NotificationPreferencesMapper.toDTO([{ key: "notifySomethingRemoved", enabled: false }]);
    expect(dto.notifyCrewCheckin).toBe(true);
    expect(dto.notifyCheer).toBe(true);
  });

  it("an explicit enabled:true override is a no-op against the default", () => {
    const dto = NotificationPreferencesMapper.toDTO([{ key: "notifyFollowing", enabled: true }]);
    expect(dto.notifyFollowing).toBe(true);
  });
});
