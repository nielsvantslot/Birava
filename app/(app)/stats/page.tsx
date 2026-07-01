import { createClient } from "@/lib/supabase/server";
import { StatsCharts } from "@/components/beer/stats-charts";
import { BeerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: entries = [] } = await supabase
    .from("beer_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const all: BeerEntry[] = entries ?? [];

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-black">Statistics 📊</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
          Your beer stats
        </p>
      </div>

      {all.length > 0 ? (
        <StatsCharts entries={all} />
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
