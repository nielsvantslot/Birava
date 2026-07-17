import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import {
  groupIntoSessions,
  activeWeeks,
  sessionTitle,
} from "@/lib/sessions";
import { computeAchievements } from "@/lib/achievements";
import { relativeDay } from "@/lib/dates";
import { getMyDrinkHistory, getRecentSessionsForUser } from "@/lib/controllers/drinkController";
import { getFollowCounts } from "@/lib/controllers/socialController";
import { avatarPhotoService } from "@/lib/avatarPhoto";
import { ProfileHead, ProfileActions } from "@/components/drink/profile-client";
import { AchievementGlyph } from "@/components/drink/achievement-icon";
import { Skeleton, SkeletonAvatarRow } from "@/components/ui/skeleton";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <>
      <Suspense fallback={<ProfileMainSkeleton />}>
        <ProfileMain user={user} />
      </Suspense>

      {/* Recent sessions is a separate fetch from everything ProfileMain
          needs — streams in on its own instead of gating (or being gated
          by) the profile head/achievements. */}
      <Suspense fallback={<RecentSessionsSkeleton />}>
        <RecentSessionsLoader userId={user.id} />
      </Suspense>

      <ProfileActions />
    </>
  );
}

async function ProfileMain({
  user,
}: {
  user: { id: string; username: string; avatarUrl: string | null; createdAt: string };
}) {
  // Independent reads — run in parallel (F2).
  const [tz, entries, followCounts] = await Promise.all([
    getUserTimeZone(),
    getMyDrinkHistory(),
    getFollowCounts({ profileId: user.id }),
  ]);
  const sessions = groupIntoSessions(entries);
  const weeks = activeWeeks(sessions, tz);

  const venues = new Set(
    entries.map((e) => e.venue?.trim()).filter((v): v is string => !!v)
  );
  const types = new Set(entries.map((e) => e.drink_type).filter(Boolean));

  const achievements = computeAchievements(entries, tz);
  const topAchievements = [...achievements]
    .sort(
      (a, b) =>
        Number(b.earned) - Number(a.earned) ||
        b.progress / b.goal - a.progress / a.goal
    )
    .slice(0, 3);

  const memberSince = new Date(user.createdAt).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <ProfileHead
        userId={user.id}
        username={user.username}
        avatarUrl={user.avatarUrl}
        memberSince={memberSince}
        followers={followCounts.followers}
        following={followCounts.following}
        supportsDirectUpload={avatarPhotoService.supportsDirectUpload}
        stats={{
          sessions: sessions.length,
          venues: venues.size,
          types: types.size,
          activeWeeks: weeks.current,
        }}
      />

      <div className="section">
        <Link
          href="/people"
          className="row"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div className="rowmark">
            <svg viewBox="0 0 24 24">
              <circle cx="9" cy="8" r="4"></circle>
              <path d="M2 21c0-4 3-6 7-6 1.2 0 2.3.15 3.2.5"></path>
              <path d="M17 14v6M14 17h6"></path>
            </svg>
          </div>
          <div className="grow">
            <b>Find people</b>
            <span>Search for friends and follow their sessions</span>
          </div>
          <span className="chev">›</span>
        </Link>
      </div>

      <div className="section">
        <div className="h-row">
          <h3>Achievements</h3>
          <Link href="/achievements">See all</Link>
        </div>
        {sessions.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--ink-dim)" }}>
            Log your first drink to start earning achievements.
          </p>
        ) : (
          topAchievements.map((a) => (
            <Link
              key={a.id}
              href="/achievements"
              className="row"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="rowmark ach">
                <AchievementGlyph icon={a.icon} />
              </div>
              <div className="grow">
                <b>{a.label}</b>
                <span>{a.progressText}</span>
              </div>
              <span className="chev">›</span>
            </Link>
          ))
        )}
      </div>
    </>
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
  if (recentSessions.length === 0) return null;

  return (
    <div className="section">
      <div className="h-row">
        <h3>Recent sessions</h3>
        <Link href="/dashboard?tab=you">All</Link>
      </div>
      {recentSessions.map((session) => {
        const meta = [
          `${session.checkins.length} check-in${session.checkins.length === 1 ? "" : "s"}`,
          session.venues.length
            ? `${session.venues.length} venue${session.venues.length === 1 ? "" : "s"}`
            : null,
          relativeDay(new Date(session.start), tz).toLowerCase(),
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <Link
            key={session.id}
            href={`/sessions/${session.id}`}
            className="row"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="rowmark">
              <svg viewBox="0 0 24 24">
                <path d="M9 3h6M12 3v4"></path>
                <path d="M7 21c-2 0-3-1.6-3-3.5C4 13 7 11 12 11s8 2 8 6.5c0 1.9-1 3.5-3 3.5z"></path>
              </svg>
            </div>
            <div className="grow">
              <b>{sessionTitle(session, tz)}</b>
              <span>{meta}</span>
            </div>
            <span className="chev">›</span>
          </Link>
        );
      })}
    </div>
  );
}

function ProfileMainSkeleton() {
  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center gap-3 px-1">
        <Skeleton className="h-16 w-16 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1.5 text-center">
            <Skeleton className="h-6 w-8 mx-auto" />
            <Skeleton className="h-3 w-12 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentSessionsSkeleton() {
  return (
    <div className="space-y-2 py-2">
      {[...Array(3)].map((_, i) => (
        <SkeletonAvatarRow key={i} line1Width="w-36" line2Width="w-20" />
      ))}
    </div>
  );
}
