import { getCurrentUser } from "@/lib/auth/session";
import { PushSubscribeToggle } from "@/components/notifications/push-subscribe-toggle";
import { NotificationPreferenceToggles } from "@/components/notifications/notification-preference-toggles";
import { getMyNotificationPreferences } from "@/lib/controllers/notificationController";
import { SignOutButton } from "@/components/drink/profile-client";
import { getAppVersion } from "@/lib/version";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { version } = getAppVersion();
  const preferences = await getMyNotificationPreferences();

  return (
    <>
      {/* Push toggle renders its own `.section` (id="push-notifications"), so
          the /settings#push-notifications anchor lands here. */}
      <PushSubscribeToggle />

      <NotificationPreferenceToggles initial={preferences} />

      <div className="section">
        <SignOutButton />
      </div>

      <p className="app-version">v{version}</p>
    </>
  );
}
