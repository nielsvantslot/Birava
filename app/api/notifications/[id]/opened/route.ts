import { z } from "zod";
import { gateway } from "@/modules/identity/server/gateway";
import { markNotificationOpened } from "@/modules/notifications";

// Hit by the service worker's notificationclick handler (public/sw.js) so a
// push tapped from the OS notification tray counts as "opened" the same as
// clicking the row in the in-app list (NotificationRowLink) — otherwise
// SESSION_REMINDER's engagement cap (modules/notifications/domain/sessionReminderAlgorithm.ts) never
// sees a real open for anyone who only ever taps the OS notification.
export const POST = gateway.route.authed(
  { name: "notifications.opened", params: z.object({ id: z.string().min(1) }) },
  async ({ user, input }) => {
    await markNotificationOpened(input.params.id, user.id);
    return null;
  }
);
