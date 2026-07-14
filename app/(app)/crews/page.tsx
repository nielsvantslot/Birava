import Link from "next/link";
import { getMyCrews } from "@/lib/controllers/groupController";
import { CreateCrewForm, JoinCrewForm } from "@/components/drink/crews-forms";

function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

export default async function CrewsPage() {
  const crews = await getMyCrews();

  return (
    <>
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
                  {crew.memberCount} member{crew.memberCount === 1 ? "" : "s"}
                  {crew.rank
                    ? ` · you're ${ordinal(crew.rank)} since you joined`
                    : ""}
                </span>
              </div>
              <span className="code">{crew.inviteCode}</span>
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
