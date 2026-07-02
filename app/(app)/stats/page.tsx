import { createClient, getUser } from "@/lib/supabase/server";
import { StatsCharts } from "@/components/beer/stats-charts";
import { Last24hRecap } from "@/components/beer/last-24h-recap";
import { BeerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

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

export default async function StatsPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const { data: entries = [] } = await supabase
    .from("beer_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const all: BeerEntry[] = entries ?? [];
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
      <div>
        <h1 className="text-2xl font-black">Statistics 📊</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
          Your beer stats
        </p>
      </div>

      {all.length > 0 ? (
        <>
          <Last24hRecap
            totalBeers={last24Total}
            checkins={last24Entries.length}
            beersPerHour={last24Pace}
            topStyle={topStyle24h}
            topBrewery={topBrewery24h}
          />
          <StatsCharts entries={all} />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-6xl mb-4">📊</span>
          <p className="font-semibold text-lg">No stats yet</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Log some beers to see charts here.
          </p>
        </div>
      )}
    </div>
  );
}
