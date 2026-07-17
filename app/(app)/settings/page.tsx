import { getCurrentUser } from "@/lib/auth/session";
import { PushSubscribeToggle } from "@/components/notifications/push-subscribe-toggle";
import { SignOutButton } from "@/components/drink/profile-client";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <>
      {/* Push toggle renders its own `.section` (id="push-notifications"), so
          the /settings#push-notifications anchor lands here. */}
      <PushSubscribeToggle />

      <div className="section">
        <SignOutButton />
      </div>
    </>
  );
}
