import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/top-bar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AddBeerFab } from "@/components/beer/add-beer-fab";
import { Beer, LayoutDashboard, BarChart2, Trophy, Rss } from "lucide-react";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      <Suspense fallback={<TopBarSkeleton />}>
        <TopBarLoader />
      </Suspense>
      <main className="flex-1 overflow-y-auto pb-24 pt-2">
        <div className="max-w-2xl mx-auto px-4">{children}</div>
      </main>
      <Suspense fallback={<BottomNavFallback />}>
        <BottomNav />
      </Suspense>
      <Suspense fallback={null}>
        <AddBeerFab />
      </Suspense>
    </div>
  );
}

async function TopBarLoader() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <TopBar
      username={profile?.username ?? user.email?.split("@")[0]}
      avatarUrl={profile?.avatar_url}
    />
  );
}

function TopBarSkeleton() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-lg">
      <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]">
            <Beer className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-[var(--foreground)]">
            Birava
          </span>
        </div>
        <div className="h-8 w-8 rounded-full bg-[var(--muted)] animate-pulse" />
      </div>
    </header>
  );
}

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/stats", icon: BarChart2, label: "Stats" },
  { href: "/leaderboard", icon: Trophy, label: "Board" },
  { href: "/feed", icon: Rss, label: "Feed" },
];

function BottomNavFallback() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--card)] safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <div
            key={href}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[var(--muted-foreground)]"
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </div>
        ))}
      </div>
    </nav>
  );
}
