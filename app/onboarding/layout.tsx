import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getMyUnreadNotificationCount } from "@/lib/controllers/notificationController";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ToastPill } from "@/components/ui/toast-pill";

/**
 * Mirrors app/(app)/layout.tsx's shell (header/sidebar/bottom nav, same
 * content-column width) minus RightRail — onboarding stays a focused funnel,
 * but a first-run user still sees the real navigation the whole time instead
 * of a standalone modal with no chrome in sight. onboarding-flow.tsx decides
 * per-step whether to fill this column (the three "real page" steps) or
 * center a narrow card within it (intro/permissions).
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      <Suspense fallback={null}>
        <SidebarNavLoader />
      </Suspense>
      <div
        className="w-full max-w-lg mx-auto md:mr-0 flex flex-col flex-1 md:flex-none min-w-0
          md:max-w-2xl
          md:ml-[max(76px,calc((100%-672px)/2))]
          xl:ml-[max(240px,calc((100%-672px)/2))]"
      >
        <Suspense fallback={null}>
          <AppHeaderLoader />
        </Suspense>
        <main className="flex-1 pb-28">{children}</main>
      </div>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
      {/* Missing here entirely was a real bug: the permissions step renders
          PushSubscribeToggle/LocationPermissionToggle, both of which call
          showToast() on their error paths — with no ToastPill mounted
          anywhere in this layout, those errors fired into a page with zero
          listeners and were silently lost (e.g. a failed push subscription
          just stopped spinning, no explanation). */}
      <ToastPill />
    </div>
  );
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
