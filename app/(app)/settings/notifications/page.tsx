import { NotificationSettings } from "@/components/notifications/notification-settings";
import { getMyNotificationPreferences } from "@/lib/controllers/notificationController";

export default async function NotificationSettingsPage() {
  const preferences = await getMyNotificationPreferences();

  return (
    <div className="section">
      {/* id="push-notifications" lives on the row itself, so
          /settings/notifications#push-notifications scrolls to the right spot. */}
      <NotificationSettings initial={preferences} />
    </div>
  );
}
