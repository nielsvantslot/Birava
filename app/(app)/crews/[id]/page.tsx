import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { getCrewBoard } from "@/lib/crews";
import { sessionTitle } from "@/lib/sessions";
import { formatDate, timeAgo } from "@/lib/dates";
import { CrewLeaderboard } from "@/components/beer/crew-leaderboard";
import { CopyCodeChip } from "@/components/beer/crews-forms";

export default async function CrewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const tz = await getUserTimeZone();

  const crew = await db.group.findUnique({
    where: { id },
    include: { members: { select: { userId: true } } },
  });
  if (!crew) notFound();
  if (!crew.members.some((m) => m.userId === user.id)) notFound();

  const { scores, recentSessions } = await getCrewBoard(id);
  const you = scores.find((s) => s.userId === user.id);
  const usernameById = new Map(scores.map((s) => [s.userId, s.username]));

  return (
    <>
      {/* crew identity */}
      <div className="section flush" style={{ padding: "20px 16px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div
            className="avatar"
            style={{ width: 56, height: 56, fontSize: 17 }}
          >
            {crew.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="grow">
            <h1
              style={{
                fontFamily: "var(--serif)",
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              {crew.name}
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "var(--ink-dim)",
                marginTop: 3,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {crew.members.length} member
              {crew.members.length === 1 ? "" : "s"} ·{" "}
              <CopyCodeChip code={crew.inviteCode} />
            </p>
          </div>
        </div>
        <div className="event">
          <span className="ev-live">
            <span className="dot"></span>Live
          </span>
          <div className="members">
            {scores.slice(0, 5).map((s) => (
              <div className="avatar" key={s.userId}>
                {s.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.avatarUrl} alt={s.username} />
                ) : (
                  s.username.slice(0, 2).toUpperCase()
                )}
              </div>
            ))}
            {scores.length > 5 && (
              <div className="avatar">+{scores.length - 5}</div>
            )}
          </div>
          <span className="ev-end">
            since {formatDate(crew.createdAt, tz)}
          </span>
        </div>
      </div>

      {/* leaderboard */}
      <div className="section">
        <div className="h-row" style={{ marginBottom: 2 }}>
          <h3>Leaderboard</h3>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--ink-dim)", marginBottom: 12 }}>
          Ranked from the day each member joined — no lifetime totals.
          {you ? ` You joined ${formatDate(new Date(you.joinedAt), tz)}.` : ""}
        </p>
        <CrewLeaderboard
          rows={scores.map((s) => ({
            userId: s.userId,
            username: s.username,
            avatarUrl: s.avatarUrl,
            sessions: s.sessions,
            venues: s.venues,
            you: s.userId === user.id,
          }))}
        />
      </div>

      {/* crew activity */}
      {recentSessions.length > 0 && (
        <div className="section">
          <div className="h-row">
            <h3>Latest in the crew</h3>
          </div>
          {recentSessions.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="row"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="avatar">
                {session.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.avatarUrl} alt={session.username} />
                ) : (
                  (usernameById.get(session.userId) ?? session.username)
                    .slice(0, 2)
                    .toUpperCase()
                )}
              </div>
              <div className="grow">
                <b>
                  {session.userId === user.id ? "You" : session.username}{" "}
                  logged a session
                </b>
                <span>
                  {sessionTitle(session, tz)} ·{" "}
                  {timeAgo(new Date(session.end), tz)}
                </span>
              </div>
              <span className="chev">›</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
