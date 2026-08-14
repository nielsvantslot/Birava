import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/drink/profile-client";
import { DeleteAccountButton } from "@/components/drink/delete-account-button";
import { getAppVersion } from "@/lib/version";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { version } = getAppVersion();

  return (
    <>
      {/* Top-level tappable rows into their own screens, not inline forms or
          toggles here — matches how Instagram's own Settings list drills
          into "Profiel bewerken" / "Meldingen" rather than editing anything
          on the main page itself. */}
      <div className="section">
        <Link href="/settings/profile" className="row" prefetch={false}>
          <div className="rowmark">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M5 21c0-4 3-6 7-6s7 2 7 6z"></path>
            </svg>
          </div>
          <div className="grow">
            <b>Profile</b>
          </div>
          <span className="chev">›</span>
        </Link>
        {/* Named "Push notifications", not "Notifications" — in-app
            notifications aren't configurable and are always on
            (lib/notify.ts always writes the Notification row); everything
            on that screen, master switch and categories alike, only ever
            gates push. */}
        <Link href="/settings/notifications" className="row" prefetch={false}>
          <div className="rowmark">
            <svg viewBox="0 0 24 24">
              <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.7 21a2 2 0 01-3.4 0"></path>
            </svg>
          </div>
          <div className="grow">
            <b>Push notifications</b>
          </div>
          <span className="chev">›</span>
        </Link>
      </div>

      <div className="section">
        <div className="h-row" style={{ marginBottom: 6 }}>
          <h3>Account</h3>
        </div>
        <SignOutButton />
      </div>

      <div className="section">
        <div className="h-row" style={{ marginBottom: 6 }}>
          <h3>Danger zone</h3>
        </div>
        <DeleteAccountButton username={user.username} />
      </div>

      <p className="app-version">v{version}</p>
    </>
  );
}
