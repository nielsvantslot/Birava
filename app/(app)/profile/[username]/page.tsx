import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { getDrinkHistoryForUser, getRecentSessionsForUser } from "@/lib/controllers/drinkController";
import { getProfileByUsername } from "@/lib/controllers/profileController";
import { getFollowCounts, isFollowingUser } from "@/lib/controllers/socialController";
import { groupIntoSessions, activeWeeks } from "@/lib/sessions";
import { computeAchievements } from "@/lib/achievements";
import { decodeUsernameParam } from "@/lib/utils";
import { FollowButton } from "@/components/drink/follow-button";
import { ProfileHead } from "@/components/drink/profile-client";
import { AchievementBadgeStrip } from "@/components/drink/achievement-badge-strip";
import { RecentSessionsList } from "@/components/drink/recent-sessions-list";
import type { ProfileDTO, SessionUserDTO } from "@/lib/dtos";
import { ProfileHeadSkeleton, RecentSessionsSkeleton } from "@/components/ui/skeleton";

interface Props {
  params: Promise<{ username: string }>;
}

export default async function PublicProfilePage({ params }: Props) {
  const { username: rawUsername } = await params;
  const username = decodeUsernameParam(rawUsername);
  if (!username) notFound();
  // targetUser has to resolve before anything can render at all (notFound(),
  // and every section below needs its id/username/avatar) — currentUser is
  // needed alongside it just to know whether this is the viewer's own
  // profile. Everything else each section separately needs (tz, follow
  // counts/state, history, recent sessions) streams in behind its own
  // Suspense instead of gating on the whole set up front.
  const [currentUser, targetUser] = await Promise.all([
    getCurrentUser(),
    getProfileByUsername({ username }),
  ]);
  if (!targetUser) notFound();
  const showFollowButton = !!currentUser && currentUser.id !== targetUser.id;

  return (
    <>
      <Suspense fallback={<ProfileHeadSkeleton showFollowButton={showFollowButton} />}>
        <PublicProfileMain currentUser={currentUser} targetUser={targetUser} />
      </Suspense>

      {/* Sessions are the hero unit app-wide — shown right after the head,
          ahead of achievements, not the other way around. */}
      <Suspense fallback={<RecentSessionsSkeleton />}>
        <RecentSessionsLoader userId={targetUser.id} />
      </Suspense>

      <Suspense fallback={null}>
        <PublicAchievementBadgesLoader userId={targetUser.id} />
      </Suspense>
    </>
  );
}

async function PublicProfileMain({
  currentUser,
  targetUser,
}: {
  currentUser: SessionUserDTO | null;
  targetUser: ProfileDTO;
}) {
  const isOwnProfile = currentUser?.id === targetUser.id;

  const [isFollowing, counts, entries] = await Promise.all([
    currentUser && !isOwnProfile
      ? isFollowingUser({ targetUserId: targetUser.id })
      : Promise.resolve(false),
    getFollowCounts({ profileId: targetUser.id }),
    getDrinkHistoryForUser({ userId: targetUser.id }),
  ]);
  const { followers: followerCount, following: followingCount } = counts;

  const sessions = groupIntoSessions(entries);
  const venues = new Set(
    entries.map((e) => e.venue?.trim()).filter((v): v is string => !!v)
  );
  const types = new Set(entries.map((e) => e.drink_type).filter(Boolean));

  const memberSince = new Date(targetUser.createdAt).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  // activeWeeks needs tz, which nothing else on this specific fetch does —
  // pulled in only here rather than widening the Promise.all above.
  const tz = await getUserTimeZone();
  const weeks = activeWeeks(sessions, tz);

  return (
    <ProfileHead
      userId={targetUser.id}
      username={targetUser.username}
      avatarUrl={targetUser.avatarUrl}
      memberSince={memberSince}
      followers={followerCount}
      following={followingCount}
      stats={{
        sessions: sessions.length,
        venues: venues.size,
        types: types.size,
        activeWeeks: weeks.current,
      }}
      followersHref={`/profile/${targetUser.username}/followers`}
      followingHref={`/profile/${targetUser.username}/following`}
      action={
        !isOwnProfile && currentUser ? (
          <FollowButton targetUserId={targetUser.id} initialIsFollowing={isFollowing} />
        ) : undefined
      }
    />
  );
}

async function RecentSessionsLoader({ userId }: { userId: string }) {
  // Independent reads — run in parallel (F2). Fetched from the real
  // DrinkSession rows, not re-derived from raw check-ins — a session's id
  // is permanent once created, so recomputing it from raw check-ins could
  // disagree with the stored id after a backdated (offline-sync) check-in
  // became chronologically first.
  const [tz, recentSessions] = await Promise.all([
    getUserTimeZone(),
    getRecentSessionsForUser({ userId, limit: 3 }),
  ]);

  return (
    <div className="section">
      <div className="h-row">
        <h3>Recent sessions</h3>
      </div>
      {recentSessions.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--ink-dim)" }}>
          No sessions yet.
        </p>
      ) : (
        <RecentSessionsList sessions={recentSessions} tz={tz} />
      )}
    </div>
  );
}

/**
 * Compact badge strip, not the full progress-card grid (that stays on
 * /achievements) — earned-only here (unlike the owner's own /profile, a
 * visitor doesn't need locked/in-progress badges spelled out).
 */
async function PublicAchievementBadgesLoader({ userId }: { userId: string }) {
  const [tz, entries] = await Promise.all([
    getUserTimeZone(),
    getDrinkHistoryForUser({ userId }),
  ]);
  const earned = computeAchievements(entries, tz).filter((a) => a.earned);
  if (earned.length === 0) return null;

  return (
    <div className="section">
      <div className="h-row">
        <h3>Achievements</h3>
      </div>
      <AchievementBadgeStrip achievements={earned} />
    </div>
  );
}
