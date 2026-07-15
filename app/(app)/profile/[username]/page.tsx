import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { getDrinkHistoryForUser, getRecentSessionsForUser } from "@/lib/controllers/drinkController";
import { getProfileByUsername } from "@/lib/controllers/profileController";
import { getFollowCounts, isFollowingUser } from "@/lib/controllers/socialController";
import {
  groupIntoSessions,
  activeWeeks,
  sessionTitle,
} from "@/lib/sessions";
import { computeAchievements } from "@/lib/achievements";
import { relativeDay } from "@/lib/dates";
import { FollowButton } from "@/components/drink/follow-button";
import { AchievementGlyph } from "@/components/drink/achievement-icon";
import type { ProfileDTO, SessionUserDTO } from "@/lib/dtos";
import { Skeleton, SkeletonAvatarRow } from "@/components/ui/skeleton";

interface Props {
  params: Promise<{ username: string }>;
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
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

  return (
    <>
      <Suspense fallback={<ProfileHeadSkeleton />}>
        <PublicProfileMain currentUser={currentUser} targetUser={targetUser} />
      </Suspense>

      <Suspense fallback={<RecentSessionsSkeleton />}>
        <RecentSessionsLoader userId={targetUser.id} />
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

  const [tz, isFollowing, counts, entries] = await Promise.all([
    getUserTimeZone(),
    currentUser && !isOwnProfile
      ? isFollowingUser({ targetUserId: targetUser.id })
      : Promise.resolve(false),
    getFollowCounts({ profileId: targetUser.id }),
    getDrinkHistoryForUser({ userId: targetUser.id }),
  ]);
  const { followers: followerCount, following: followingCount } = counts;

  const sessions = groupIntoSessions(entries);
  const weeks = activeWeeks(sessions, tz);
  const venues = new Set(
    entries.map((e) => e.venue?.trim()).filter((v): v is string => !!v)
  );
  const types = new Set(entries.map((e) => e.drink_type).filter(Boolean));
  const earned = computeAchievements(entries, tz).filter((a) => a.earned);

  const memberSince = new Date(targetUser.createdAt).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <div className="section flush">
        <div className="profile-head">
          <div className="avatar">
            {targetUser.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={targetUser.avatarUrl} alt={targetUser.username} />
            ) : (
              targetUser.username.slice(0, 2).toUpperCase()
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{targetUser.username}</h1>
            <p>
              member since {memberSince} · {followerCount} followers ·{" "}
              {followingCount} following
            </p>
          </div>
          {!isOwnProfile && currentUser && (
            <FollowButton
              targetUserId={targetUser.id}
              initialIsFollowing={isFollowing}
            />
          )}
        </div>
        <div style={{ padding: "0 16px 20px" }}>
          <div className="stats">
            <div className="stat">
              <div className="label">Sessions</div>
              <div className="num">{sessions.length}</div>
            </div>
            <div className="stat">
              <div className="label">Venues</div>
              <div className="num">{venues.size}</div>
            </div>
            <div className="stat">
              <div className="label">Types tried</div>
              <div className="num">{types.size}</div>
            </div>
            <div className="stat">
              <div className="label">Active wks</div>
              <div className="num">{weeks.current}</div>
            </div>
          </div>
        </div>
      </div>

      {earned.length > 0 && (
        <div className="section">
          <div className="h-row">
            <h3>Achievements</h3>
          </div>
          {earned.map((a) => (
            <div key={a.id} className="row">
              <div className="rowmark ach">
                <AchievementGlyph icon={a.icon} />
              </div>
              <div className="grow">
                <b>{a.label}</b>
                <span>{a.progressText}</span>
              </div>
            </div>
          ))}
        </div>
      )}
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
        recentSessions.map((session) => {
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
        })
      )}
    </div>
  );
}

function ProfileHeadSkeleton() {
  return (
    <div className="space-y-4 py-4 px-1">
      <div className="flex items-center gap-3">
        <Skeleton className="h-16 w-16 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-48" />
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
