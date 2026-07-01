import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/beer/stat-card";
import { BeerCard } from "@/components/beer/beer-card";
import { Last24hRecap } from "@/components/beer/last-24h-recap";
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

function getTopCategory(
  entries: BeerEntry[],
  selector: (entry: BeerEntry) => string | null
) {
  const scores = new Map<string, number>();

  for (const entry of entries) {
    const key = selector(entry);
    if (!key) continue;
    scores.set(key, (scores.get(key) ?? 0) + entry.amount);
  }

  let top: string | null = null;
  let topScore = 0;
  for (const [key, score] of scores.entries()) {
    if (score > topScore) {
      top = key;
      topScore = score;
    }
  }

  return top;
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
  const last24WindowStartDate = new Date();
  last24WindowStartDate.setHours(last24WindowStartDate.getHours() - 24);
  const last24WindowStart = last24WindowStartDate.getTime();
  const last24Entries = all.filter(
    (entry) => new Date(entry.created_at).getTime() >= last24WindowStart
  );
  const last24Total = last24Entries.reduce((sum, entry) => sum + entry.amount, 0);
  const last24Pace = last24Total / 24;
  const topStyle24h = getTopCategory(last24Entries, (entry) => entry.style);
  const topBrewery24h = getTopCategory(last24Entries, (entry) => entry.brewery);

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

      <Last24hRecap
        totalBeers={last24Total}
        checkins={last24Entries.length}
        beersPerHour={last24Pace}
        topStyle={topStyle24h}
        topBrewery={topBrewery24h}
      />

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
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
          Recent Beers
        </h2>
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
