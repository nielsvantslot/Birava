import { LeaderboardEntry } from "@/lib/types";

export function buildLeaderboard(
  entries: Array<{
    user_id: string;
    amount: number;
    created_at: string;
    profiles:
      | { username: string; avatar_url: string | null }
      | { username: string; avatar_url: string | null }[]
      | null;
  }>
): LeaderboardEntry[] {
  const today = new Date();
  const perUser: Record<string, LeaderboardEntry> = {};
  const daysByUser: Record<string, Set<string>> = {};

  for (const e of entries) {
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
      daysByUser[uid] = new Set();
    }
    perUser[uid].total += e.amount;
    const d = new Date(e.created_at);
    daysByUser[uid].add(d.toLocaleDateString());
    if (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    ) {
      perUser[uid].today += e.amount;
    }
  }

  for (const uid in perUser) {
    const days = daysByUser[uid];
    perUser[uid].avg_per_day =
      days.size > 0
        ? Math.round((perUser[uid].total / days.size) * 10) / 10
        : 0;
  }

  return Object.values(perUser).sort((a, b) => b.total - a.total);
}
