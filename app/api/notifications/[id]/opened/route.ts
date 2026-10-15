import { requireUser } from "@/modules/identity/server/requireUser";
import { markNotificationOpened } from "@/modules/notifications";

// Hit by the service worker's notificationclick handler (public/sw.js) so a
// push tapped from the OS notification tray counts as "opened" the same as
// clicking the row in the in-app list (NotificationRowLink) — otherwise
// SESSION_REMINDER's engagement cap (modules/notifications/domain/sessionReminderAlgorithm.ts) never
// sees a real open for anyone who only ever taps the OS notification.
export const POST = requireUser<RouteContext<"/api/notifications/[id]/opened">>(
  async (_request, user, { params }) => {
    const { id } = await params;
    await markNotificationOpened(id, user.id);
    return new Response(null, { status: 204 });
  }
);
