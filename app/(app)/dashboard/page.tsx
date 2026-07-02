import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/beer/stat-card";
import { BeerCard } from "@/components/beer/beer-card";
import { getEarnedAchievements } from "@/lib/achievements";
import { BeerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

function getTodayBeers(entries: BeerEntry[]) {
  const today = new Date();
  return entries
    .filter((e) => {
      const d = new Date(e.created_at);
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    })
    .reduce((sum, e) => sum + e.amount, 0);
}

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

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: entries = [] } = await supabase
    .from("beer_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const all = entries ?? [];
  const total = all.reduce((sum: number, e: BeerEntry) => sum + e.amount, 0);
  const todayCount = getTodayBeers(all);
  const streak = getStreak(all);
  const avg = getAvgPerDay(all);
  const recent = all.slice(0, 5);
  const achievements = getEarnedAchievements(total);

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black">Dashboard 🍺</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
          Your beer tracker
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Beers" value={total} emoji="🍺" highlight />
        <StatCard label="Today" value={todayCount} emoji="☀️" />
        <StatCard label="Streak" value={`${streak}d`} emoji="🔥" sub="days in a row" />
        <StatCard label="Avg / Day" value={avg} emoji="📊" />
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
            Achievements
          </h2>
          <div className="flex flex-wrap gap-2">
            {achievements.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1.5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 px-3 py-1.5"
              >
                <span className="text-lg">{a.emoji}</span>
                <span className="text-sm font-semibold text-[var(--primary)]">
                  {a.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent beers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
            Recent Beers
          </h2>
          <Link
            href="/history"
            className="text-xs font-medium text-[var(--primary)] hover:underline"
          >
            View all →
          </Link>
        </div>
        {recent.length > 0 ? (
          <div className="space-y-2">
            {recent.map((entry: BeerEntry) => (
              <BeerCard key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-5xl mb-3">🍺</span>
            <p className="font-semibold text-[var(--foreground)]">
              No beers yet!
            </p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Tap the + button to log your first one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
