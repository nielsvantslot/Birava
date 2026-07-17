import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getMyUnreadNotificationCount } from "@/lib/controllers/notificationController";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { RightRail } from "@/components/layout/right-rail";
import { ToastPill } from "@/components/ui/toast-pill";
import { TimezoneSync } from "@/components/timezone-sync";
import { PendingCheckinsSync } from "@/components/drink/pending-checkins-sync";
import { drinkPhotoService } from "@/lib/photoUpload";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      {/* usePathname reads request data — must sit inside Suspense under cacheComponents.
          Fixed to the viewport edge, outside the centered block below. */}
      <Suspense fallback={null}>
        <SidebarNavLoader />
      </Suspense>
      <div className="flex flex-col md:flex-row md:gap-10 flex-1 w-full">
        <div
          className="w-full max-w-lg mx-auto md:mr-0 flex flex-col flex-1 md:flex-none min-w-0
            md:max-w-2xl
            md:ml-[max(76px,calc((100%-672px)/2))]
            xl:ml-[max(240px,calc((100%-672px)/2))]"
        >
          <Suspense fallback={<HeaderSkeleton />}>
            <AppHeaderLoader />
          </Suspense>
          {/* Pages read cookies (getCurrentUser) at render; under cacheComponents
              that dynamic access must stream inside a Suspense boundary. Routes
              with their own loading.tsx use that nested boundary instead. */}
          <main className="flex-1 pb-28">
            <Suspense fallback={null}>{children}</Suspense>
          </main>
        </div>
        <Suspense fallback={null}>
          <RightRailLoader />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
      <ToastPill />
      <TimezoneSync />
      <Suspense fallback={null}>
        <PendingCheckinsSyncLoader />
      </Suspense>
    </div>
  );
}

async function PendingCheckinsSyncLoader() {
  const user = await getCurrentUser();
  if (!user) return null;

  return <PendingCheckinsSync userId={user.id} supportsDirectUpload={drinkPhotoService.supportsDirectUpload} />;
}

async function AppHeaderLoader() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const unreadCount = await getMyUnreadNotificationCount();
  return <AppHeader userId={user.id} username={user.username} avatarUrl={user.avatarUrl} unreadCount={unreadCount} />;
}

async function SidebarNavLoader() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const unreadCount = await getMyUnreadNotificationCount();
  return <SidebarNav userId={user.id} username={user.username} avatarUrl={user.avatarUrl} unreadCount={unreadCount} />;
}

async function RightRailLoader() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <RightRail userId={user.id} username={user.username} avatarUrl={user.avatarUrl} />;
}

function HeaderSkeleton() {
  return (
    <header className="header sticky top-0 z-40 md:!hidden">
      <div className="left">
        <div className="hicon avatar-btn" />
      </div>
      <div className="title" />
      <div className="right" />
    </header>
  );
}
