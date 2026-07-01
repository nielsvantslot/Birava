import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeaderboardEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Get user's groups
  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id, groups(name)")
    .eq("user_id", user.id);

  const groupIds = memberships?.map((m) => m.group_id) ?? [];

  // Build leaderboard from groups or all-time personal if no groups
  let leaderboard: LeaderboardEntry[] = [];

  if (groupIds.length > 0) {
    const { data: entries } = await supabase
      .from("beer_entries")
      .select("user_id, amount, created_at, profiles(username, avatar_url)")
      .in("group_id", groupIds);

    const today = new Date();
    const perUser: Record<string, LeaderboardEntry> = {};

    for (const e of entries ?? []) {
      const uid = e.user_id;
      const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
      if (!perUser[uid]) {
        perUser[uid] = {
          user_id: uid,
          username: profile?.username ?? "Unknown",
          avatar_url: profile?.avatar_url ?? null,
          total: 0,
          today: 0,
          avg_per_day: 0,
        };
      }
      perUser[uid].total += e.amount;
      const d = new Date(e.created_at);
      if (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      ) {
        perUser[uid].today += e.amount;
      }
    }

    // Calculate avg per day
    for (const uid in perUser) {
      const userEntries = (entries ?? []).filter((e) => e.user_id === uid);
      const days = new Set(
        userEntries.map((e) => new Date(e.created_at).toLocaleDateString())
      );
      perUser[uid].avg_per_day =
        days.size > 0
          ? Math.round((perUser[uid].total / days.size) * 10) / 10
          : 0;
    }

    leaderboard = Object.values(perUser).sort((a, b) => b.total - a.total);
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-black">Leaderboard 🏆</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
          Holiday beer rankings
        </p>
      </div>

      {leaderboard.length > 0 ? (
        <div className="space-y-2">
          {leaderboard.map((entry, index) => (
            <Card
              key={entry.user_id}
              className={
                entry.user_id === user.id
                  ? "border-[var(--primary)] bg-[var(--primary)]/5"
                  : ""
              }
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl w-8 text-center">
                    {medals[index] ?? `#${index + 1}`}
                  </span>
                  <Avatar className="h-10 w-10">
                    {entry.avatar_url && <AvatarImage src={entry.avatar_url} />}
                    <AvatarFallback>
                      {entry.username[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{entry.username}</p>
                      {entry.user_id === user.id && (
                        <Badge variant="secondary" className="text-xs">you</Badge>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Today: {entry.today} · Avg: {entry.avg_per_day}/day
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-[var(--primary)]">
                      {entry.total}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">beers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-6xl mb-4">🏆</span>
          <p className="font-semibold text-lg">No group yet</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Join or create a group to see the leaderboard.
          </p>
        </div>
      )}
    </div>
  );
}
