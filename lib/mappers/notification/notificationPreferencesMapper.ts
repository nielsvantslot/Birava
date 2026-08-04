import type { NotificationPreferencesDTO } from "@/lib/dtos";

type NotificationPreferencesRow = {
  notifyCrewCheckin: boolean;
  notifyCheer: boolean;
  notifyCrewActivity: boolean;
  notifyAchievement: boolean;
  notifyFollowing: boolean;
  notifySessionReminder: boolean;
};

export class NotificationPreferencesMapper {
  static toDTO(row: NotificationPreferencesRow): NotificationPreferencesDTO {
    return {
      notifyCrewCheckin: row.notifyCrewCheckin,
      notifyCheer: row.notifyCheer,
      notifyCrewActivity: row.notifyCrewActivity,
      notifyAchievement: row.notifyAchievement,
      notifyFollowing: row.notifyFollowing,
      notifySessionReminder: row.notifySessionReminder,
    };
  }
}
