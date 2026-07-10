import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { BeerEntry } from "@/lib/types";
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
import { getSessionProosts } from "@/lib/controllers/socialController";
import { formatTime, relativeDayTime } from "@/lib/dates";
import { SessionMap, MapPin } from "@/components/beer/session-map";
import { SocialActs } from "@/components/beer/social-row";
import { drinkPhotoSrc } from "@/lib/utils";

type VenueGroup = { venue: string | null; checkins: BeerEntry[] };

/** Consecutive same-venue runs, in visit order — the splits grouping. */
function groupByVenueRun(checkins: BeerEntry[]): VenueGroup[] {
  const groups: VenueGroup[] = [];
  for (const c of checkins) {
    const venue = c.venue?.trim() || null;
    const last = groups[groups.length - 1];
    if (last && last.venue === venue) last.checkins.push(c);
    else groups.push({ venue, checkins: [c] });
  }
  return groups;
}

function timeRange(checkins: BeerEntry[], tz: string): string {
  const first = formatTime(new Date(checkins[0].created_at), tz);
  if (checkins.length === 1) return first;
  const last = formatTime(
    new Date(checkins[checkins.length - 1].created_at),
    tz
  );
  return first === last ? first : `${first} – ${last}`;
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

  // Local Legend needs the owner's own history; the proost state is
  // independent — fetch both in parallel (F2).
  const [ownForLegend, proostMap] = await Promise.all([
    isSelf ? getMyDrinkHistory() : Promise.resolve(null),
    getSessionProosts({ entryIds: [session.id] }),
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

  const proost = proostMap.get(session.id) ?? { count: 0, on: false };

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
        <div className="who">
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
        </div>
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

      {/* Check-ins (the splits), grouped by venue */}
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

        {venueGroups.map((group, gi) => {
          const startIndex = venueGroups
            .slice(0, gi)
            .reduce((sum, g) => sum + g.checkins.length, 0);
          return (
            <div key={gi}>
              {group.venue && (
                <div className="venue-head">
                  <span
                    className={
                      legendVenue && group.venue === legendVenue
                        ? "vdot legend"
                        : "vdot"
                    }
                  ></span>
                  <b>{group.venue}</b>
                  <span className="vmeta">{timeRange(group.checkins, tz)}</span>
                </div>
              )}
              <div className="splits">
                {group.checkins.map((c, ci) => {
                  const sub = [
                    c.drink_type,
                    formatTime(new Date(c.created_at), tz),
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const inner = (
                    <>
                      <div className="idx">{startIndex + ci + 1}</div>
                      <div className="grow">
                        <b>{c.beer_name?.trim() || c.drink_type}</b>
                        <div className="sub">{sub}</div>
                      </div>
                      {isSelf && <span className="chev">›</span>}
                    </>
                  );
                  return isSelf ? (
                    <Link
                      key={c.id}
                      className="split"
                      href={`/log?edit=${c.id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="split" key={c.id}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Photos */}
      {session.photoIds.length > 0 && (
        <div className="section flush" style={{ padding: "14px 0" }}>
          <div className="h-row" style={{ padding: "0 16px" }}>
            <h3>Photos</h3>
          </div>
          <div className="gallery">
            {session.photoIds.map((id, i) => (
              <div key={id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={drinkPhotoSrc(id)}
                  alt={`Session photo ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* social */}
      <div className="section flush">
        <SocialActs
          entryId={session.id}
          count={proost.count}
          on={proost.on}
          shareText={shareText}
        />
      </div>
    </>
  );
}
