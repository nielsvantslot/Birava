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
        <div className="h-row">
          <h3>Your crews</h3>
        </div>
        {crews.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--ink-dim)" }}>
            No crews yet — start one below or join with a code.
          </p>
        ) : (
          crews.map((crew) => (
            // prefetch={false}: staleTimes.dynamic is 0 (next.config.ts), so
            // prefetching every crew's detail page on render is pure waste.
            <Link
              key={crew.id}
              href={`/crews/${crew.id}`}
              className="row"
              style={{ textDecoration: "none", color: "inherit" }}
              prefetch={false}
            >
              <div className="avatar">{crew.name.slice(0, 2).toUpperCase()}</div>
              <div className="grow">
                <b>{crew.name}</b>
                <span>
                  {crew.memberCount} member{crew.memberCount === 1 ? "" : "s"}
                  {crew.closed ? " · Closed" : ""}
                  {crew.rank
                    ? ` · you're ${ordinal(crew.rank)} since you joined`
                    : ""}
                </span>
              </div>
              {/* A closed crew stops accepting new members (joinGroup blocks
                  it), so showing the code that no longer works is misleading. */}
              {!crew.closed && <span className="code">{crew.inviteCode}</span>}
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
