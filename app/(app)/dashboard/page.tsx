import Link from "next/link";
import { Fragment } from "react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { groupIntoSessions, getLocalLegendVenue } from "@/lib/sessions";
import { getFeedDrinkHistory } from "@/lib/queries/drinkEntryQueries";
import { getProostStates } from "@/lib/proost";
import { ScreenTabs } from "@/components/ui/screen-tabs";
import { SessionCard } from "@/components/beer/session-card";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { tab } = await searchParams;
  const showOnlyOwn = tab === "you";
  const tz = await getUserTimeZone();

  // The follows query is only needed for the "Following" feed — skip it on
  // the "You" tab, where its result would be discarded (F2).
  const following = showOnlyOwn
    ? []
    : await db.follow.findMany({
        where: { followerId: user.id },
        select: { followingId: true },
      });
  const userIds = showOnlyOwn
    ? [user.id]
    : [user.id, ...following.map((f) => f.followingId)];

  const all = await getFeedDrinkHistory(userIds);
  const sessions = groupIntoSessions(all).slice(0, 12);
  const legendVenue = getLocalLegendVenue(
    all.filter((e) => e.user_id === user.id)
  );
  const proosts = await getProostStates(
    sessions.map((s) => s.id),
    user.id
  );

  // The Local Legend callout appears once, on the newest own session
  const newestOwnId = sessions.find((s) => s.userId === user.id)?.id;

  return (
    <>
      <ScreenTabs
        tabs={[
          { label: "Following", href: "/dashboard", active: !showOnlyOwn },
          { label: "You", href: "/dashboard?tab=you", active: showOnlyOwn },
        ]}
      />

      {sessions.length === 0 ? (
        <div
          className="section"
          style={{ textAlign: "center", padding: "48px 16px" }}
        >
          <h3
            style={{
              fontFamily: "var(--serif)",
              fontSize: 20,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            No sessions yet
          </h3>
          <p style={{ fontSize: 14, color: "var(--ink-dim)", marginBottom: 20 }}>
            Log a drink and your first session starts here.
          </p>
          <Link className="btn btn-primary" href="/log">
            Log a drink
          </Link>
        </div>
      ) : (
        sessions.map((session, index) => (
          <Fragment key={session.id}>
            <SessionCard
              session={session}
              tz={tz}
              isSelf={session.userId === user.id}
              legendVenue={session.id === newestOwnId ? legendVenue : null}
              proost={proosts.get(session.id) ?? { count: 0, on: false }}
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
        ))
      )}
    </>
  );
}
