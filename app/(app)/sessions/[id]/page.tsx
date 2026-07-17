import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { DrinkEntry } from "@/lib/types";
import {
  defaultSessionTitle,
  getLocalLegendVenue,
  sessionMinutes,
  sessionTitle,
  type DrinkSession,
} from "@/lib/sessions";
import {
  getSession,
  getMyDrinkHistory,
} from "@/lib/controllers/drinkController";
import { getSessionCheers, getSessionComments, getCommentCounts } from "@/lib/controllers/socialController";
import { formatTime, relativeDayTime } from "@/lib/dates";
import { avatarSrc } from "@/lib/utils";
import { SessionMap, MapPin } from "@/components/drink/session-map";
import { SessionTitle } from "@/components/drink/session-title";
import { SocialActs } from "@/components/drink/social-row";
import { CheckinGrid } from "@/components/drink/checkin-grid";
import { CommentsSection } from "@/components/drink/comments-section";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

type VenueGroup = { venue: string | null; checkins: DrinkEntry[] };

/** Consecutive same-venue runs, in visit order — the splits grouping. */
function groupByVenueRun(checkins: DrinkEntry[]): VenueGroup[] {
  const groups: VenueGroup[] = [];
  for (const c of checkins) {
    const venue = c.venue?.trim() || null;
    const last = groups[groups.length - 1];
    if (last && last.venue === venue) last.checkins.push(c);
    else groups.push({ venue, checkins: [c] });
  }
  return groups;
}

function checkinCaption(c: DrinkEntry, tz: string): string {
  return [c.drink_name?.trim() || c.drink_type, c.venue, formatTime(new Date(c.created_at), tz)]
    .filter(Boolean)
    .join(" · ");
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;

  // session+tz are a hard prerequisite — nothing can render before we know
  // the session exists (notFound()) and have its checkins to show. Local
  // Legend/map, cheers, and comments are each a separate, independent fetch
  // that only one specific piece of UI needs, so each streams in behind its
  // own Suspense instead of gating (or being gated by) the others.
  const [tz, session] = await Promise.all([
    getUserTimeZone(),
    getSession({ id }),
  ]);
  if (!session) notFound();

  const isSelf = session.userId === user.id;
  const checkins = session.checkins;
  const lone = checkins.length === 1;
  const minutes = sessionMinutes(session);
  const title = sessionTitle(session, tz);
  const defaultTitle = defaultSessionTitle(session, tz);

  const startMeta = relativeDayTime(new Date(session.start), tz);
  const endTime = formatTime(new Date(session.end), tz);
  const meta = lone ? startMeta : `${startMeta} – ${endTime}`;

  const shareText = lone
    ? `${session.username} logged ${title} on Birava`
    : `${session.username} — ${title} on Birava: ${checkins.length} check-ins, ${session.venues.length || 1} ${session.venues.length === 1 ? "venue" : "venues"}`;

  return (
    <>
      {/* who + serif title + full stat row */}
      <div className="section flush">
        <Link className="who" href={`/profile/${session.username}`}>
          <div className="avatar">
            {session.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc(session.userId)} alt={session.username} />
            ) : (
              session.username.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="grow">
            <b>{session.username}</b>
            <div className="meta">
              {meta}
              {session.venues[0] ? ` · ${session.venues[0]}` : ""}
            </div>
          </div>
        </Link>
        <SessionTitle
          sessionId={session.id}
          title={title}
          defaultTitle={defaultTitle}
          isOwnName={!!session.name}
          isSelf={isSelf}
        />
        {!lone && (
          <div className="act-stats">
            <div className="stats big">
              <div className="stat">
                <div className="label">Check-ins</div>
                <div className="num">{checkins.length}</div>
              </div>
              <div className="stat">
                <div className="label">Venues</div>
                <div className="num">{session.venues.length || "—"}</div>
              </div>
              <div className="stat">
                <div className="label">Out for</div>
                <div className="num">
                  {minutes >= 60 ? (
                    <>
                      {Math.floor(minutes / 60)}
                      <small>h</small> {minutes % 60}
                      <small>m</small>
                    </>
                  ) : (
                    <>
                      {minutes}
                      <small>m</small>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* route map + Local Legend — both derive from the owner's full
          history (to find the legend venue and to highlight its pin), a
          separate fetch from everything else on the page. */}
      <Suspense fallback={<MapSkeleton />}>
        <MapAndLegendLoader session={session} isSelf={isSelf} />
      </Suspense>

      {/* Check-ins (the splits), chronological — needs only session+tz */}
      <div className="section flush" style={{ padding: "6px 0 14px" }}>
        <div
          className="h-row"
          style={{ padding: "12px 16px 2px", marginBottom: 0 }}
        >
          <h3>Check-ins</h3>
          <span
            style={{
              fontSize: 13,
              color: "var(--ink-dim)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {checkins.length}
            {session.venues.length > 0
              ? ` · ${session.venues.length} ${session.venues.length === 1 ? "venue" : "venues"}`
              : ""}
          </span>
        </div>

        <CheckinGrid
          items={checkins.map((c, i) => ({
            id: c.id,
            order: i + 1,
            title: c.drink_name?.trim() || c.drink_type,
            sub: [c.venue, formatTime(new Date(c.created_at), tz)]
              .filter(Boolean)
              .join(" · "),
            caption: checkinCaption(c, tz),
            hasPhoto: !!c.photo_url,
            lqip: c.photo_lqip,
            editHref: isSelf ? `/log?edit=${c.id}` : null,
          }))}
        />
      </div>

      {/* social */}
      <div className="section flush">
        <Suspense fallback={<SocialSkeleton />}>
          <SocialLoader sessionId={session.id} shareText={shareText} isOwner={isSelf} />
        </Suspense>
      </div>

      {/* comments */}
      <div className="section flush">
        <Suspense fallback={<CommentsSkeleton />}>
          <CommentsLoader sessionId={session.id} tz={tz} currentUserId={user.id} />
        </Suspense>
      </div>
    </>
  );
}

async function MapAndLegendLoader({
  session,
  isSelf,
}: {
  session: DrinkSession;
  isSelf: boolean;
}) {
  const checkins = session.checkins;
  const venueGroups = groupByVenueRun(checkins);

  const ownForLegend = isSelf ? await getMyDrinkHistory() : null;
  let legendVenue: string | null = null;
  if (ownForLegend) {
    legendVenue = getLocalLegendVenue(ownForLegend);
    if (legendVenue && !session.venues.includes(legendVenue)) {
      legendVenue = null;
    }
  }

  const routePoints = checkins
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => ({ lat: c.lat as number, lng: c.lng as number }));

  // One numbered pin per venue, placed at its first located check-in
  const pins: MapPin[] = [];
  const pinned = new Set<string>();
  for (const group of venueGroups) {
    if (!group.venue || pinned.has(group.venue)) continue;
    const located = group.checkins.find((c) => c.lat != null && c.lng != null);
    if (!located) continue;
    pinned.add(group.venue);
    pins.push({
      point: { lat: located.lat as number, lng: located.lng as number },
      label: String(pins.length + 1),
      legend: !!legendVenue && group.venue === legendVenue,
    });
  }

  return (
    <>
      {routePoints.length > 0 && (
        <div className="section flush">
          <SessionMap points={routePoints} pins={pins.length ? pins : undefined} />
        </div>
      )}

      {legendVenue && (
        <div className="section flush" style={{ padding: "16px 0" }}>
          <div className="callout">
            <div className="mark">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3l2.2 4.6 5 .7-3.6 3.6.9 5.1L12 14.6 7.5 17l.9-5.1L4.8 8.3l5-.7z"></path>
              </svg>
            </div>
            <div>
              <b>Local Legend — {legendVenue}</b>
              <p>
                You have more check-ins here than anyone else in the last 90
                days. Hold the lead to keep the crown.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

async function SocialLoader({
  sessionId,
  shareText,
  isOwner,
}: {
  sessionId: string;
  shareText: string;
  isOwner: boolean;
}) {
  // Independent reads — run in parallel (F2). Counts only, not the full
  // thread — CommentsLoader (a separate Suspense boundary) fetches that
  // independently, so this doesn't duplicate that query for just a length.
  const [cheerMap, commentCounts] = await Promise.all([
    getSessionCheers({ sessionIds: [sessionId] }),
    getCommentCounts({ sessionIds: [sessionId] }),
  ]);
  const cheer = cheerMap.get(sessionId) ?? { count: 0, on: false };
  const commentCount = commentCounts.get(sessionId) ?? 0;

  return (
    <SocialActs
      sessionId={sessionId}
      count={cheer.count}
      on={cheer.on}
      commentCount={commentCount}
      shareText={shareText}
      isOwner={isOwner}
    />
  );
}

async function CommentsLoader({
  sessionId,
  tz,
  currentUserId,
}: {
  sessionId: string;
  tz: string;
  currentUserId: string;
}) {
  const commentsMap = await getSessionComments({ sessionIds: [sessionId] });
  const comments = commentsMap.get(sessionId) ?? [];

  return (
    <CommentsSection
      sessionId={sessionId}
      tz={tz}
      currentUserId={currentUserId}
      initial={comments}
    />
  );
}

function MapSkeleton() {
  return (
    <div className="section flush" style={{ padding: "16px" }}>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

function SocialSkeleton() {
  return (
    <div className="flex gap-4 py-2">
      <Skeleton className="h-8 w-16 rounded-full" />
      <Skeleton className="h-8 w-16 rounded-full" />
      <Skeleton className="h-8 w-16 rounded-full" />
    </div>
  );
}

function CommentsSkeleton() {
  return (
    <SkeletonCard className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </SkeletonCard>
  );
}
