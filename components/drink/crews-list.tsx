import Link from "next/link";
import { ordinal } from "@/lib/utils";
import type { CrewSummary } from "@/lib/queries/groupQueries";

interface CrewsListProps {
  crews: CrewSummary[];
}

/** The current user's crew memberships — same row shape as user-list.tsx. */
export function CrewsList({ crews }: CrewsListProps) {
  if (crews.length === 0) {
    return (
      <p style={{ fontSize: 14, color: "var(--ink-dim)" }}>
        No crews yet — start one below or join with a code.
      </p>
    );
  }

  return (
    <>
      {crews.map((crew) => (
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
              {crew.rank ? ` · you're ${ordinal(crew.rank)} since you joined` : ""}
            </span>
          </div>
          {/* A closed crew stops accepting new members (joinGroup blocks it),
              so showing the code that no longer works is misleading. */}
          {!crew.closed && <span className="code">{crew.inviteCode}</span>}
        </Link>
      ))}
    </>
  );
}
