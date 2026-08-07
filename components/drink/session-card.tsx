import Link from "next/link";
import Image from "next/image";
import { DrinkEntry } from "@/lib/types";
import {
  DrinkSession,
  sessionMinutes,
  sessionTitle,
} from "@/lib/sessions";
import { formatTime, relativeDayTime } from "@/lib/dates";
import { avatarSrc, drinkPhotoSrc } from "@/lib/utils";
import { Minimap } from "@/components/drink/minimap";
import { SocialActs } from "@/components/drink/social-row";
import { CheckinExpander } from "@/components/drink/checkin-expander";
import { LocalLegendCallout } from "@/components/drink/local-legend-callout";

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function DurationNum({ minutes }: { minutes: number }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <div className="num">
      {h > 0 && (
        <>
          {h}
          <small>h</small>{" "}
        </>
      )}
      {m}
      <small>m</small>
    </div>
  );
}

function checkinSub(entry: DrinkEntry, tz: string): string {
  return [entry.drink_type, entry.venue, formatTime(new Date(entry.created_at), tz)]
    .filter(Boolean)
    .join(" · ");
}

export function SessionSplits({
  checkins,
  tz,
  compact,
}: {
  checkins: DrinkEntry[];
  tz: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "splits compact" : "splits"}>
      {checkins.map((c, i) => (
        <div className="split" key={c.id}>
          <div className="idx">{i + 1}</div>
          <div className="grow">
            <b>{c.drink_name?.trim() || c.drink_type}</b>
            <div className="sub">{checkinSub(c, tz)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * One session in the feed — the Strava-style hero unit. Sizes to content:
 * a lone check-in renders as the slim card with no fake session stats.
 */
export function SessionCard({
  session,
  tz,
  isSelf,
  legendVenue,
  cheer,
  commentCount,
  priority,
}: {
  session: DrinkSession;
  tz: string;
  isSelf: boolean;
  /** The viewer's Local Legend venue — shown only on own sessions that include it. */
  legendVenue: string | null;
  cheer: { count: number; on: boolean };
  commentCount: number;
  /** Set for the first card in the feed so its hero photo isn't lazy-loaded (LCP). */
  priority?: boolean;
}) {
  const checkins = session.checkins;
  const lone = checkins.length === 1;
  const multiVenue = session.venues.length >= 2;
  const minutes = sessionMinutes(session);
  const title = sessionTitle(session, tz);
  const heroPhotoId = session.photoIds[0] ?? null;
  const heroLqip = heroPhotoId
    ? checkins.find((c) => c.id === heroPhotoId)?.photo_lqip ?? null
    : null;
  const routePoints = checkins
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => ({ lat: c.lat as number, lng: c.lng as number }));
  const showLegend =
    isSelf && !!legendVenue && session.venues.includes(legendVenue);

  const meta = [
    relativeDayTime(new Date(session.start), tz),
    session.venues[0],
  ]
    .filter(Boolean)
    .join(" · ");

  const shareText = lone
    ? `${session.username} logged ${title} on Birava`
    : `${session.username} — ${title} on Birava: ${checkins.length} check-ins, ${session.venues.length || 1} ${session.venues.length === 1 ? "venue" : "venues"}`;

  return (
    <div className="section flush">
      {/* prefetch={false} on both links below: the feed can render many of
          these cards at once, and staleTimes.dynamic is 0 (next.config.ts),
          so prefetching every visible card's profile/session link on scroll
          is pure waste. */}
      <Link className="who" href={`/profile/${session.username}`} prefetch={false}>
        <div className="avatar">
          {session.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc(session.userId)} alt={session.username} />
          ) : (
            initials(session.username)
          )}
        </div>
        <div className="grow">
          <b>{session.username}</b>
          <div className="meta">{meta}</div>
        </div>
      </Link>

      <Link className="act-title-link" href={`/sessions/${session.id}`} prefetch={false}>
        <div className="act-title">
          {title}
          <span className="chev-in">›</span>
        </div>
      </Link>

      {!lone && (
        <div className="act-stats">
          <div className="stats">
            <div className="stat">
              <div className="label">Check-ins</div>
              <div className="num">{checkins.length}</div>
            </div>
            {multiVenue ? (
              <>
                <div className="stat">
                  <div className="label">Venues</div>
                  <div className="num">{session.venues.length}</div>
                </div>
                <div className="stat">
                  <div className="label">Out for</div>
                  <DurationNum minutes={minutes} />
                </div>
              </>
            ) : (
              <>
                <div className="stat">
                  <div className="label">Venue</div>
                  <div className="num" style={{ fontSize: 18, paddingTop: 5 }}>
                    {session.venues[0] ?? "—"}
                  </div>
                </div>
                <div className="stat">
                  <div className="label">Type</div>
                  <div className="num" style={{ fontSize: 18, paddingTop: 5 }}>
                    {session.types.length > 1 ? "Mixed" : session.types[0] ?? "—"}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {heroPhotoId && (
        <div className={multiVenue || lone ? "card-photo" : "card-photo short"}>
          <div className="card-photo-frame">
            <Image
              src={drinkPhotoSrc(heroPhotoId)}
              alt={`${title} photo`}
              fill
              sizes="(min-width: 768px) 640px, calc(100vw - 32px)"
              style={{ objectFit: "cover" }}
              priority={priority}
              placeholder={heroLqip ? "blur" : undefined}
              blurDataURL={heroLqip ?? undefined}
            />
          </div>
        </div>
      )}

      {lone && (
        <div className="checkin-line">
          <span className="meta">
            {[checkins[0].drink_type, checkins[0].venue]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      )}
      {!lone && routePoints.length >= 2 && multiVenue && (
        <Link className="routechip" href={`/sessions/${session.id}`} prefetch={false}>
          <Minimap points={routePoints} />
          <div className="grow">
            <b>
              {session.venues[0]} → {session.venues[session.venues.length - 1]}
            </b>
            <div className="rsub">
              {session.venues.length} venues · view route
            </div>
          </div>
          <span className="chev">›</span>
        </Link>
      )}

      {showLegend && legendVenue && <LocalLegendCallout venue={legendVenue} />}

      {!lone && (
        <CheckinExpander count={checkins.length}>
          <SessionSplits checkins={checkins} tz={tz} compact />
        </CheckinExpander>
      )}

      <SocialActs
        sessionId={session.id}
        count={cheer.count}
        on={cheer.on}
        commentCount={commentCount}
        shareText={shareText}
        isOwner={isSelf}
      />
    </div>
  );
}

export { duration as formatDuration };
