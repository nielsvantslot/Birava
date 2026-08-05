import { after } from "next/server";
import { db } from "@/lib/db";
import type { NotificationType } from "@prisma/client";
import { sendPushToUser } from "@/lib/push/sendPush";
import { describeNotification } from "@/lib/notifications";
import type { NotificationPreferenceKey } from "@/lib/dtos";

export type NotificationEvent = {
  // Only set when the caller needs the same id available at push-send time
  // as at read time (e.g. SESSION_REMINDER's message-variant seed) —
  // otherwise left to the DB's @default(uuid()).
  id?: string;
  userId: string;
  type: NotificationType;
  actorId?: string;
  actorUsername?: string;
  actorAvatarUrl?: string | null;
  entryId?: string;
  groupId?: string;
  groupName?: string;
  achievementLabel?: string;
};

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
 * Writes notification rows + sends push, deferred via `after()` so the
 * triggering mutation (cheers, follow, check-in, ...) isn't slowed down by it.
 * The in-app Notification row is always created regardless of the
 * recipient's category preferences (lib/dtos's NotificationPreferenceKey,
 * /settings/notifications) — those toggles gate push only, so the in-app
 * list always shows everything even with a category (or push entirely)
 * turned off.
 */
export function queueNotifications(events: NotificationEvent[]) {
  const filtered = events.filter((e) => e.userId !== e.actorId);
  if (filtered.length === 0) return;

  after(async () => {
    await db.notification.createMany({ data: filtered });

    // NotificationPreference is sparse — only categories a user explicitly
    // turned off have a row (see lib/commands/notificationCommands.ts), so
    // absence here means the category is still at its default: enabled.
    const userIds = [...new Set(filtered.map((e) => e.userId))];
    const overrides = await db.notificationPreference.findMany({
      where: { userId: { in: userIds } },
    });
    const disabledKeysByUser = new Map<string, Set<string>>();
    for (const o of overrides) {
      if (o.enabled) continue;
      const keys = disabledKeysByUser.get(o.userId) ?? new Set<string>();
      keys.add(o.key);
      disabledKeysByUser.set(o.userId, keys);
    }

    const pushAllowed = filtered.filter((e) => {
      const key = PREFERENCE_KEY_BY_TYPE[e.type];
      return !disabledKeysByUser.get(e.userId)?.has(key);
    });
    if (pushAllowed.length === 0) return;

    await Promise.allSettled(
      pushAllowed.map((e) => {
        const { message, href } = describeNotification(e.type, e);
        return sendPushToUser(e.userId, { title: "Birava", body: message, url: href });
      })
    );
  });
}
