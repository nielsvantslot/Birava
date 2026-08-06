import { NOTIFICATION_PREFERENCE_KEYS, type NotificationPreferenceKey, type NotificationPreferencesDTO } from "@/lib/dtos";

export type NotificationPreferenceOverride = { key: string; enabled: boolean };

function isPreferenceKey(key: string): key is NotificationPreferenceKey {
  return (NOTIFICATION_PREFERENCE_KEYS as readonly string[]).includes(key);
}

export class NotificationPreferencesMapper {
  /**
   * `overrides` is sparse (NotificationPreference only stores rows for
   * categories a user has explicitly turned off — see
   * lib/commands/notificationCommands.ts) — every category not present
   * here is still enabled, the default. Unrecognized keys are ignored
   * rather than thrown on, in case a row ever predates a renamed/removed
   * category.
   */
  static toDTO(overrides: NotificationPreferenceOverride[]): NotificationPreferencesDTO {
    const dto: NotificationPreferencesDTO = {
      notifyCrewCheckin: true,
      notifyCheer: true,
      notifyCrewActivity: true,
      notifyAchievement: true,
      notifyFollowing: true,
      notifySessionReminder: true,
    };
    for (const { key, enabled } of overrides) {
      if (isPreferenceKey(key)) dto[key] = enabled;
    }
    return dto;
  }
}
