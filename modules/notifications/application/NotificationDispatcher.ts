import type { NotificationPreferenceKey } from "@/lib/dtos";
import { describeNotification, type NotificationType } from "@/modules/notifications/domain/notifications";
import type { INotificationRepository } from "@/modules/notifications/domain/INotificationRepository";
import type { IPushSender } from "@/modules/notifications/domain/IPushSender";
import type { NotificationEvent } from "@/modules/notifications/domain/NotificationEvent";

// Maps each event type to the settings-page category that gates it. FOLLOW
// and SESSION_START share "Following" — neither is its own requested
// category, and both are about a person's follow graph rather than a crew.
const PREFERENCE_KEY_BY_TYPE: Record<NotificationType, NotificationPreferenceKey> = {
  CREW_CHECKIN: "notifyCrewCheckin",
  CHEER: "notifyCheer",
  // Bucketed with CHEER, not its own toggle — both are a viewer reacting to
  // one of your sessions, same "Cheers & comments" category on the
  // settings page (components/notifications/notification-preference-toggles.tsx).
  COMMENT: "notifyCheer",
  CREW_JOIN: "notifyCrewActivity",
  // Bucketed with CREW_JOIN — an invite is crew-membership activity, same
  // category as joining. Not its own toggle: neither #159 nor #163 asked
  // for one, and this repo's notification settings only cover the four
  // categories #159 defined.
  CREW_INVITE: "notifyCrewActivity",
  ACHIEVEMENT: "notifyAchievement",
  FOLLOW: "notifyFollowing",
  SESSION_START: "notifyFollowing",
  SESSION_REMINDER: "notifySessionReminder",
};

/**
 * Writes the notification rows for a batch of events, then sends push to the
 * recipients whose settings allow it. The in-app Notification row is always
 * created regardless of the recipient's category preferences
 * (NotificationPreferenceKey, /settings/notifications) — those toggles gate
 * push only, so the in-app list always shows everything even with a category
 * (or push entirely) turned off.
 */
export class NotificationDispatcher {
  constructor(
    private readonly notifications: INotificationRepository,
    private readonly push: IPushSender
  ) {}

  async dispatch(events: NotificationEvent[]): Promise<void> {
    if (events.length === 0) return;

    let persisted = events;
    try {
      await this.notifications.createMany(events);
    } catch {
      // createMany is one INSERT statement — a single malformed/stale row
      // (e.g. userId/actorId pointing at an account deleted between the
      // triggering mutation and this deferred flush) throws for the WHOLE
      // batch, silently dropping every other recipient's notification too.
      // Falling back to one-at-a-time isolates the actually-bad row instead,
      // matching the per-recipient isolation the push-send phase below
      // already has via Promise.allSettled.
      const results = await Promise.allSettled(events.map((event) => this.notifications.create(event)));
      // A row that could not be written has nothing for a push to link to, so it gets no push either.
      persisted = events.filter((_, i) => results[i]!.status === "fulfilled");
    }

    // Sparse: only categories a user explicitly turned off have a row (see
    // notificationCommands.ts), so absence means the category is still at
    // its default: enabled.
    const disabled = await this.notifications.disabledCategories([...new Set(persisted.map((e) => e.userId))]);

    const pushAllowed = persisted.filter((e) => !disabled.get(e.userId)?.has(PREFERENCE_KEY_BY_TYPE[e.type]));
    if (pushAllowed.length === 0) return;

    await Promise.allSettled(
      pushAllowed.map((e) => {
        const { message, href } = describeNotification(e.type, e);
        return this.push.send(e.userId, { title: "Birava", body: message, url: href, id: e.id });
      })
    );
  }
}
