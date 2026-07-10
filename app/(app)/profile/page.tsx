import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { getUserHistory } from "@/lib/reads";
import {
  groupIntoSessions,
  activeWeeks,
  sessionTitle,
} from "@/lib/sessions";
import { computeAchievements } from "@/lib/achievements";
import { relativeDay } from "@/lib/dates";
import { getFollowCounts } from "@/lib/controllers/socialController";
import { ProfileHead, ProfileActions } from "@/components/beer/profile-client";
import { AchievementGlyph } from "@/components/beer/achievement-icon";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const tz = await getUserTimeZone();
  // Independent reads — run in parallel (F2).
  const [entries, followCounts] = await Promise.all([
    getUserHistory(user.id),
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

  const recentSessions = sessions.slice(0, 3);

  const memberSince = new Date(user.createdAt).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <ProfileHead
        username={user.username}
        avatarUrl={user.avatarUrl}
        memberSince={memberSince}
        followers={followCounts.followers}
        following={followCounts.following}
        stats={{
          sessions: sessions.length,
          venues: venues.size,
          types: types.size,
          activeWeeks: weeks.current,
        }}
      />

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

      {recentSessions.length > 0 && (
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
      )}

      <ProfileActions />
    </>
  );
}
