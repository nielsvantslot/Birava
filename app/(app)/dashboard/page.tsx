import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { getLocalLegendVenue } from "@/lib/sessions";
import { getMyFeedSessions, getMyDrinkHistory } from "@/lib/controllers/drinkController";
import { ScreenTabs } from "@/components/ui/screen-tabs";
import { DashboardFeed } from "@/components/drink/dashboard-feed";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { tab } = await searchParams;
  const showOnlyOwn = tab === "you";

  const [tz, feedPage, ownHistory] = await Promise.all([
    getUserTimeZone(),
    getMyFeedSessions({ onlyOwn: showOnlyOwn }),
    getMyDrinkHistory(),
  ]);
  const { sessions, cheers, commentCounts, nextCursor } = feedPage;
  const legendVenue = getLocalLegendVenue(ownHistory);

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
        <DashboardFeed
          // Remounts fresh on tab switch instead of reconciling paginated
          // client state against a brand new server-rendered first page.
          key={showOnlyOwn ? "you" : "following"}
          initialSessions={sessions}
          initialCheers={cheers}
          initialCommentCounts={commentCounts}
          initialNextCursor={nextCursor}
          tz={tz}
          currentUserId={user.id}
          onlyOwn={showOnlyOwn}
          legendVenue={legendVenue}
          newestOwnId={newestOwnId}
        />
      )}
    </>
  );
}
