import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ToastPill } from "@/components/ui/toast-pill";
import { TimezoneSync } from "@/components/timezone-sync";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      <div className="w-full max-w-lg mx-auto flex flex-col flex-1">
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
      {/* usePathname reads request data — must sit inside Suspense under cacheComponents */}
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
      <ToastPill />
      <TimezoneSync />
    </div>
  );
}

async function AppHeaderLoader() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <AppHeader username={user.username} avatarUrl={user.avatar_url} />;
}

function HeaderSkeleton() {
  return (
    <header className="header sticky top-0 z-40">
      <div className="left">
        <div className="hicon avatar-btn" />
      </div>
      <div className="title" />
      <div className="right" />
    </header>
  );
}
