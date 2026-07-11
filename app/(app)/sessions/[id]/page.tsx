import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { DrinkEntry } from "@/lib/types";
import {
  findSessionWithCheckin,
  getLocalLegendVenue,
  sessionMinutes,
  sessionTitle,
} from "@/lib/sessions";
import {
  getSessionCheckins,
  getMyDrinkHistory,
} from "@/lib/controllers/drinkController";
import { getSessionCheers, getSessionComments } from "@/lib/controllers/socialController";
import { formatTime, relativeDayTime } from "@/lib/dates";
import { SessionMap, MapPin } from "@/components/drink/session-map";
import { SocialActs } from "@/components/drink/social-row";
import { CheckinGrid } from "@/components/drink/checkin-grid";
import { CommentsSection } from "@/components/drink/comments-section";

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

  // The session is computed, never stored: fetch the ±48h window around the
  // anchor and pick the session that contains it.
  const [tz, windowCheckins] = await Promise.all([
    getUserTimeZone(),
    getSessionCheckins({ anchorId: id }),
  ]);
  if (!windowCheckins) notFound();

  const session = findSessionWithCheckin(windowCheckins, id);
  if (!session) notFound();

  const isSelf = session.userId === user.id;
  const checkins = session.checkins;
  const lone = checkins.length === 1;
  const minutes = sessionMinutes(session);
  const title = sessionTitle(session, tz);
  const venueGroups = groupByVenueRun(checkins);

  // Local Legend needs the owner's own history; the cheer state and
  // comment thread are independent — fetch all three in parallel (F2).
  const [ownForLegend, cheerMap, commentsMap] = await Promise.all([
    isSelf ? getMyDrinkHistory() : Promise.resolve(null),
    getSessionCheers({ entryIds: [session.id] }),
    getSessionComments({ entryIds: [session.id] }),
  ]);

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

  const cheer = cheerMap.get(session.id) ?? { count: 0, on: false };
  const comments = commentsMap.get(session.id) ?? [];

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
              <img src={session.avatarUrl} alt={session.username} />
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
        <div className="act-title" style={{ paddingBottom: 14 }}>
          {title}
        </div>
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

      {/* route map */}
      {routePoints.length > 0 && (
        <div className="section flush">
          <SessionMap points={routePoints} pins={pins.length ? pins : undefined} />
        </div>
      )}

      {/* Local Legend — explained achievement earned here */}
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

      {/* Check-ins (the splits), chronological */}
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
        <SocialActs
          entryId={session.id}
          count={cheer.count}
          on={cheer.on}
          commentCount={comments.length}
          shareText={shareText}
        />
      </div>

      {/* comments */}
      <div className="section flush">
        <CommentsSection
          entryId={session.id}
          tz={tz}
          currentUserId={user.id}
          initial={comments}
        />
      </div>
    </>
  );
}
