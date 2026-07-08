import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { toBeerEntry } from "@/lib/mappers";
import { ProfileClient } from "@/components/beer/profile-client";
import { BeerEntry } from "@/lib/types";
import { getFollowCounts } from "@/lib/actions/social";


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
  const user = await getCurrentUser();
  if (!user) return null;

  const entries = await db.beerEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const all: BeerEntry[] = entries.map(toBeerEntry);
  const totalBeers = all.reduce((sum, e) => sum + e.amount, 0);
  const streak = getStreak(all);
  const avgPerDay = getAvgPerDay(all);
  const followCounts = await getFollowCounts(user.id);

  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <ProfileClient
      username={user.username}
      email={user.email}
      avatarUrl={user.avatar_url}
      totalBeers={totalBeers}
      streak={streak}
      avgPerDay={avgPerDay}
      memberSince={memberSince}
      followers={followCounts.followers}
      following={followCounts.following}
    />
  );
}
