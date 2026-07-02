import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/top-bar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AddBeerFab } from "@/components/beer/add-beer-fab";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      <TopBar
        username={profile?.username ?? user.email?.split("@")[0]}
        avatarUrl={profile?.avatar_url}
      />
      <main className="flex-1 overflow-y-auto pb-24 pt-2">
        <div className="max-w-2xl mx-auto px-4">{children}</div>
      </main>
      <BottomNav />
      <AddBeerFab />
    </div>
  );
}
