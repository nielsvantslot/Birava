import { createClient } from "@/lib/supabase/server";
import { BeerCard } from "@/components/beer/beer-card";
import { BeerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
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

  const all: BeerEntry[] = entries ?? [];

  // Group by date
  const groups: Record<string, BeerEntry[]> = {};
  for (const entry of all) {
    const key = new Date(entry.created_at).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-black">History 📋</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
          All {all.reduce((s, e) => s + e.amount, 0)} beers logged
        </p>
      </div>

      {Object.keys(groups).length > 0 ? (
        Object.entries(groups).map(([date, dayEntries]) => (
          <div key={date}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-[var(--muted-foreground)]">
                {date}
              </h2>
              <span className="text-xs font-medium text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-full">
                {dayEntries.reduce((s, e) => s + e.amount, 0)} 🍺
              </span>
            </div>
            <div className="space-y-2">
              {dayEntries.map((entry) => (
                <BeerCard key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-6xl mb-4">📋</span>
          <p className="font-semibold text-lg">No history yet</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Start logging beers to see them here.
          </p>
        </div>
      )}
    </div>
  );
}
