import Link from "next/link";
import { sessionTitle, type DrinkSession } from "@/lib/sessions";
import { relativeDay } from "@/lib/dates";
import { BeerGlassIcon } from "@/components/drink/beer-glass-icon";

interface RecentSessionsListProps {
  sessions: DrinkSession[];
  tz: string;
}

/**
 * Row rendering for a "Recent sessions" list — shared by profile/page.tsx
 * and profile/[username]/page.tsx so they can't drift apart, the same way
 * their skeleton (RecentSessionsSkeleton, components/ui/skeleton.tsx) is
 * already shared. Each page keeps its own header/empty-state around this,
 * since those genuinely differ (own profile hides the whole section when
 * empty; a public profile says "No sessions yet.").
 */
export function RecentSessionsList({ sessions, tz }: RecentSessionsListProps) {
  return (
    <>
      {sessions.map((session) => {
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
            prefetch={false}
          >
            <div className="rowmark">
              <BeerGlassIcon />
            </div>
            <div className="grow">
              <b>{sessionTitle(session, tz)}</b>
              <span>{meta}</span>
            </div>
            <span className="chev">›</span>
          </Link>
        );
      })}
    </>
  );
}
