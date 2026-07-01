import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "@/components/beer/profile-client";
import { BeerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

function getStreak(entries: BeerEntry[]): number {
  if (!entries.length) return 0;
  const days = new Set(
    entries.map((e) => new Date(e.created_at).toLocaleDateString())
  );
  const daysArr = Array.from(days).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  let streak = 0;
  const check = new Date();
  for (const day of daysArr) {
    const d = new Date(day);
    if (
      d.getDate() === check.getDate() &&
      d.getMonth() === check.getMonth() &&
      d.getFullYear() === check.getFullYear()
    ) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function getAvgPerDay(entries: BeerEntry[]): string {
  if (!entries.length) return "0";
  const days = new Set(
    entries.map((e) => new Date(e.created_at).toLocaleDateString())
  );
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  return (total / days.size).toFixed(1);
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: entries = [] }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, avatar_url, created_at")
      .eq("id", user.id)
      .single(),
    supabase
      .from("beer_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const all: BeerEntry[] = entries ?? [];
  const totalBeers = all.reduce((sum, e) => sum + e.amount, 0);
  const streak = getStreak(all);
  const avgPerDay = getAvgPerDay(all);

  const memberSince = new Date(
    profile?.created_at ?? user.created_at
  ).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <ProfileClient
      username={profile?.username ?? user.email?.split("@")[0] ?? "User"}
      email={user.email ?? ""}
      avatarUrl={profile?.avatar_url ?? null}
      totalBeers={totalBeers}
      streak={streak}
      avgPerDay={avgPerDay}
      memberSince={memberSince}
    />
  );
}
