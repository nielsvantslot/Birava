import Link from "next/link";
import { sessionTitle, type DrinkSession } from "@/lib/sessions";
import { relativeDay } from "@/lib/dates";

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
    </>
  );
}
