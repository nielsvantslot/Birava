import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { toBeerEntry } from "@/lib/mappers";
import {
  groupIntoSessions,
  activeWeeks,
  sessionTitle,
} from "@/lib/sessions";
import { computeAchievements } from "@/lib/achievements";
import { relativeDay } from "@/lib/dates";
import { FollowButton } from "@/components/beer/follow-button";
import { AchievementGlyph } from "@/components/beer/achievement-icon";

interface Props {
  params: Promise<{ username: string }>;
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const currentUser = await getCurrentUser();

  const targetUser = await db.user.findUnique({ where: { username } });
  if (!targetUser) notFound();

  const isOwnProfile = currentUser?.id === targetUser.id;
  const tz = await getUserTimeZone();

  const [followCheck, followerCount, followingCount, entryRows] =
    await Promise.all([
      currentUser && !isOwnProfile
        ? db.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: currentUser.id,
                followingId: targetUser.id,
              },
            },
          })
        : Promise.resolve(null),
      db.follow.count({ where: { followingId: targetUser.id } }),
      db.follow.count({ where: { followerId: targetUser.id } }),
      db.drinkEntry.findMany({
        where: { userId: targetUser.id },
        include: { user: { select: { username: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const entries = entryRows.map(toBeerEntry);
  const sessions = groupIntoSessions(entries);
  const weeks = activeWeeks(sessions, tz);
  const venues = new Set(
    entries.map((e) => e.venue?.trim()).filter((v): v is string => !!v)
  );
  const types = new Set(entries.map((e) => e.drink_type).filter(Boolean));
  const earned = computeAchievements(entries, tz).filter((a) => a.earned);
  const recentSessions = sessions.slice(0, 3);

  const memberSince = targetUser.createdAt.toLocaleDateString("en-GB", {
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
              initialIsFollowing={followCheck !== null}
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
    </>
  );
}
