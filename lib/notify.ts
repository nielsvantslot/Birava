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
 * Recipients who've turned off an event's category (lib/dtos's
 * NotificationPreferenceKey, settings page) never get the Notification row
 * created at all, not just no push.
 */
export function queueNotifications(events: NotificationEvent[]) {
  const filtered = events.filter((e) => e.userId !== e.actorId);
  if (filtered.length === 0) return;

  after(async () => {
    const userIds = [...new Set(filtered.map((e) => e.userId))];
    const prefs = await db.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        notifyCrewCheckin: true,
        notifyCheer: true,
        notifyCrewActivity: true,
        notifyAchievement: true,
        notifyFollowing: true,
        notifySessionReminder: true,
      },
    });
    const prefById = new Map(prefs.map((p) => [p.id, p]));

    const allowed = filtered.filter((e) => {
      const pref = prefById.get(e.userId);
      return pref ? pref[PREFERENCE_KEY_BY_TYPE[e.type]] : true;
    });
    if (allowed.length === 0) return;

    await db.notification.createMany({ data: allowed });
    await Promise.allSettled(
      allowed.map((e) => {
        const { message, href } = describeNotification(e.type, e);
        return sendPushToUser(e.userId, { title: "Birava", body: message, url: href });
      })
    );
  });
}
