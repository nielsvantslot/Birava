import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getCrewBoard } from "@/lib/crews";
import { CreateCrewForm, JoinCrewForm } from "@/components/beer/crews-forms";

function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

export default async function CrewsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const memberships = await db.groupMember.findMany({
    where: { userId: user.id },
    include: { group: { include: { members: { select: { userId: true } } } } },
    orderBy: { joinedAt: "desc" },
  });

  const crews = await Promise.all(
    memberships.map(async (m) => {
      const { scores } = await getCrewBoard(m.groupId);
      const rank = 1 + scores.findIndex((s) => s.userId === user.id);
      return {
        id: m.group.id,
        name: m.group.name,
        code: m.group.inviteCode,
        members: m.group.members.length,
        rank: rank > 0 ? rank : null,
      };
    })
  );

  return (
    <>
      <div className="section">
        <div className="h-row">
          <h3>Your crews</h3>
        </div>
        {crews.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--ink-dim)" }}>
            No crews yet — start one below or join with a code.
          </p>
        ) : (
          crews.map((crew) => (
            <Link
              key={crew.id}
              href={`/crews/${crew.id}`}
              className="row"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="avatar">{crew.name.slice(0, 2).toUpperCase()}</div>
              <div className="grow">
                <b>{crew.name}</b>
                <span>
                  {crew.members} member{crew.members === 1 ? "" : "s"}
                  {crew.rank
                    ? ` · you're ${ordinal(crew.rank)} since you joined`
                    : ""}
                </span>
              </div>
              <span className="code">{crew.code}</span>
            </Link>
          ))
        )}
      </div>

      <div className="section">
        <div className="h-row" style={{ marginBottom: 6 }}>
          <h3>Start a crew</h3>
        </div>
        <p style={{ fontSize: 14, color: "var(--ink-dim)", marginBottom: 16 }}>
          Plan the trip, set the window, keep score. Everyone&apos;s ranked
          from the day they join.
        </p>
        <CreateCrewForm />
      </div>

      <div className="section">
        <div className="h-row" style={{ marginBottom: 6 }}>
          <h3>Join with a code</h3>
        </div>
        <JoinCrewForm />
      </div>
    </>
  );
}
