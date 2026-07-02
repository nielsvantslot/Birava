import { notFound } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FollowButton } from "@/components/beer/follow-button";
import { getEarnedAchievements } from "@/lib/achievements";
import { BeerEntry } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Beer } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ username: string }>;
}

function getStreak(entries: { created_at: string }[]): number {
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

function getAvgPerDay(entries: { created_at: string; amount: number }[]): string {
  if (!entries.length) return "0";
  const days = new Set(
    entries.map((e) => new Date(e.created_at).toLocaleDateString())
  );
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  return (total / days.size).toFixed(1);
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();
  const currentUser = await getUser();

  // Fetch the target profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, created_at")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  // If viewing own profile, redirect to /profile
  // (We still render the public view here for simplicity)

  const isOwnProfile = currentUser?.id === profile.id;

  // Fetch follow status and counts in parallel
  const [followCheckResult, followCountsResult, entriesResult] =
    await Promise.all([
      currentUser && !isOwnProfile
        ? supabase
            .from("follows")
            .select("follower_id")
            .eq("follower_id", currentUser.id)
            .eq("following_id", profile.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.rpc("get_follow_counts", { profile_id: profile.id }),
      supabase
        .from("beer_entries")
        .select("id, beer_name, brewery, style, amount, notes, created_at, user_id")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const isFollowing = followCheckResult.data !== null;
  const followerCount = Number(followCountsResult.data?.[0]?.followers ?? 0);
  const followingCount = Number(followCountsResult.data?.[0]?.following ?? 0);

  const entries = (entriesResult.data ?? []) as BeerEntry[];
  const totalBeers = entries.reduce((sum, e) => sum + e.amount, 0);
  const streak = getStreak(entries);
  const avgPerDay = getAvgPerDay(entries);
  const achievements = getEarnedAchievements(totalBeers);
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black">Profile 👤</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
          @{profile.username}
        </p>
      </div>

      {/* Avatar + identity */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 text-xl">
              {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="bg-[var(--primary)]/20 text-[var(--primary)] font-black">
                {profile.username[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg truncate">{profile.username}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Member since {memberSince}
              </p>
              <div className="flex gap-4 mt-1.5 text-xs text-[var(--muted-foreground)]">
                <span>
                  <span className="font-semibold text-[var(--foreground)]">
                    {followerCount}
                  </span>{" "}
                  followers
                </span>
                <span>
                  <span className="font-semibold text-[var(--foreground)]">
                    {followingCount}
                  </span>{" "}
                  following
                </span>
              </div>
            </div>

            {!isOwnProfile && currentUser && (
              <FollowButton
                targetUserId={profile.id}
                initialIsFollowing={isFollowing}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
          Stats
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-[var(--primary)] bg-[var(--primary)]/5">
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-black text-[var(--primary)]">
                {totalBeers}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Total 🍺
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-black">{streak}d</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Streak 🔥
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-black">{avgPerDay}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Avg/day 📊
              </p>
            </CardContent>
          </Card>
        </div>
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
                <div>
                  <p className="text-sm font-semibold text-[var(--primary)] leading-tight">
                    {a.label}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] leading-tight">
                    {a.description}
                  </p>
                </div>
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
        {entries.length > 0 ? (
          <div className="space-y-2">
            {entries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                      <Beer className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">
                          {entry.beer_name ?? "Beer"}
                        </span>
                        {entry.amount !== 1 && (
                          <Badge variant="secondary">×{entry.amount}</Badge>
                        )}
                        {entry.style && (
                          <Badge variant="outline">{entry.style}</Badge>
                        )}
                      </div>
                      {entry.brewery && (
                        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                          {entry.brewery}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-sm text-[var(--foreground)]/70 mt-1 italic">
                          &ldquo;{entry.notes}&rdquo;
                        </p>
                      )}
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        {formatDate(entry.created_at)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="text-4xl mb-2">🍺</span>
            <p className="text-sm text-[var(--muted-foreground)]">
              No beers logged yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
