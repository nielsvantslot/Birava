"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { SessionCard } from "@/components/drink/session-card";
import { getMyFeedSessions, type FeedSessionsPage } from "@/lib/controllers/drinkController";
import type { DrinkSession } from "@/lib/sessions";
import type { CheerState } from "@/lib/queries/cheerQueries";

type Cursor = { endedAt: string; id: string };

/**
 * The dashboard feed, with Instagram-style infinite scroll: the initial page
 * is server-rendered (page.tsx), everything past it loads as the viewer
 * nears the bottom. Fetches getMyFeedSessions directly as a server action —
 * same function and page shape the initial server render used, so there's
 * exactly one way a page of feed data gets assembled.
 *
 * Keyed by the caller on `onlyOwn` (see page.tsx) so switching tabs remounts
 * this component fresh instead of needing an effect to reset paginated state
 * against new initial props.
 */
export function DashboardFeed({
  initialSessions,
  initialCheers,
  initialCommentCounts,
  initialNextCursor,
  tz,
  currentUserId,
  onlyOwn,
  legendVenue,
  newestOwnId,
}: {
  initialSessions: DrinkSession[];
  initialCheers: FeedSessionsPage["cheers"];
  initialCommentCounts: FeedSessionsPage["commentCounts"];
  initialNextCursor: Cursor | null;
  tz: string;
  currentUserId: string;
  onlyOwn: boolean;
  legendVenue: string | null;
  newestOwnId: string | undefined;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [cheers, setCheers] = useState(() => new Map<string, CheerState>(initialCheers));
  const [commentCounts, setCommentCounts] = useState(() => new Map<string, number>(initialCommentCounts));
  const [cursor, setCursor] = useState(initialNextCursor);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cursor || isPending) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        startTransition(async () => {
          try {
            const page = await getMyFeedSessions({
              onlyOwn,
              beforeEndedAt: cursor.endedAt,
              beforeId: cursor.id,
            });
            setSessions((prev) => [...prev, ...page.sessions]);
            setCheers((prev) => new Map([...prev, ...page.cheers]));
            setCommentCounts((prev) => new Map([...prev, ...page.commentCounts]));
            setCursor(page.nextCursor);
          } catch {
            // Offline/network blip — stop auto-retrying so we don't spam
            // failed requests; the sentinel simply stays put.
            setFailed(true);
          }
        });
      },
      // Start fetching well before the sentinel is actually on-screen, so
      // the next page is usually there by the time the viewer scrolls to it.
      { rootMargin: "800px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, isPending, onlyOwn]);

  return (
    <>
      {sessions.map((session, index) => (
        <Fragment key={session.id}>
          <SessionCard
            session={session}
            tz={tz}
            isSelf={session.userId === currentUserId}
            legendVenue={session.id === newestOwnId ? legendVenue : null}
            cheer={cheers.get(session.id) ?? { count: 0, on: false }}
            commentCount={commentCounts.get(session.id) ?? 0}
            priority={index === 0}
          />
          {index === 0 && (
            <div className="hint">
              <span className="mark">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="M12 16v-4M12 8h.01"></path>
                </svg>
              </span>
              <div>
                <b>Check-ins on the same night group into a session.</b> Log
                each drink as you go — Birava stitches your evening together.
              </div>
            </div>
          )}
        </Fragment>
      ))}
      {cursor && !failed && <div ref={sentinelRef} aria-hidden style={{ height: 1 }} />}
      {isPending && (
        <div style={{ textAlign: "center", padding: "20px 16px", fontSize: 13.5, color: "var(--ink-dim)" }}>
          Loading more…
        </div>
      )}
    </>
  );
}
