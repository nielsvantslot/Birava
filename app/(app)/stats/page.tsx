import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { getMyDrinkHistory } from "@/lib/controllers/drinkController";
import { groupIntoSessions, activeWeeks } from "@/lib/sessions";
import { computeAchievements } from "@/lib/achievements";
import { weekIndex } from "@/lib/dates";
import { DRINK_TYPES } from "@/lib/types";
import { ScreenTabs } from "@/components/ui/screen-tabs";
import { AchievementGlyph } from "@/components/drink/achievement-icon";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

function SessionsPerWeekChart({
  counts,
  monthLabels,
}: {
  counts: number[]; // oldest first, 12 weeks
  monthLabels: Array<{ index: number; label: string }>;
}) {
  const max = Math.max(...counts, 4);
  const top = 18;
  const bottom = 122;
  const x = (i: number) => 8 + (i * 304) / (counts.length - 1);
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const pts = counts.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p}`).join(" ");
  const area = `${line} L${x(counts.length - 1).toFixed(1)} ${bottom} L${x(0).toFixed(1)} ${bottom} Z`;
  const mid = Math.round(max / 2);

  return (
    <svg
      className="linechart"
      viewBox="0 0 358 150"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Sessions per week over the last 12 weeks"
    >
      <line x1="0" y1={y(max)} x2="316" y2={y(max)} stroke="rgba(242,238,228,0.10)" strokeWidth="1" />
      <line x1="0" y1={y(mid)} x2="316" y2={y(mid)} stroke="rgba(242,238,228,0.10)" strokeWidth="1" />
      <line x1="0" y1={bottom} x2="316" y2={bottom} stroke="rgba(242,238,228,0.10)" strokeWidth="1" />
      <text x="324" y={y(max) + 4} className="axis-label">
        {max}
      </text>
      <text x="324" y={y(mid) + 4} className="axis-label">
        {mid}
      </text>
      <text x="324" y={bottom + 4} className="axis-label">
        0
      </text>
      <path d={area} fill="#A9C641" opacity="0.12" />
      <path
        d={line}
        fill="none"
        stroke="#A9C641"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill="#A9C641" stroke="#111510" strokeWidth="2">
        {counts.slice(0, -1).map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="4" />
        ))}
      </g>
      <circle
        cx={x(counts.length - 1)}
        cy={y(counts[counts.length - 1])}
        r="5.5"
        fill="#A9C641"
        stroke="#EEF2E7"
        strokeWidth="2"
      />
      {monthLabels.map((m) => (
        <text key={m.index} x={x(m.index)} y="144" className="axis-label">
          {m.label}
        </text>
      ))}
    </svg>
  );
}

export default async function StatsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <>
      {/* Tabs need none of the stats data below — render immediately
          instead of waiting behind the same fetch as everything else. */}
      <ScreenTabs
        tabs={[
          { label: "Overview", active: true },
          { label: "Sessions", toast: "Full session history — soon" },
          { label: "Records", toast: "Personal records — soon" },
        ]}
      />
      <Suspense fallback={<StatsBodySkeleton />}>
        <StatsBody />
      </Suspense>
    </>
  );
}

async function StatsBody() {
  const [tz, entries] = await Promise.all([
    getUserTimeZone(),
    getMyDrinkHistory(),
  ]);
  const sessions = groupIntoSessions(entries);

  if (sessions.length === 0) {
    return (
      <div className="section" style={{ textAlign: "center", padding: "48px 16px" }}>
        <p style={{ fontSize: 14.5, color: "var(--ink-dim)" }}>
          Stats appear after your first session.
        </p>
      </div>
    );
  }

  const venues = new Set(
    entries.map((e) => e.venue?.trim()).filter((v): v is string => !!v)
  );
  const drinksTried = new Set(
    entries
      .map((e) => e.drink_name?.trim().toLowerCase())
      .filter((n): n is string => !!n)
  );
  const weeks = activeWeeks(sessions, tz);
  const achievements = computeAchievements(entries, tz);
  const teaser = [...achievements]
    .sort((a, b) => Number(b.earned) - Number(a.earned) || b.progress / b.goal - a.progress / a.goal)
    .slice(0, 2);

  // Sessions per calendar week, last 12 weeks (oldest first)
  const thisWeek = weekIndex(new Date(), tz);
  const perWeek = new Map<number, number>();
  for (const s of sessions) {
    const w = weekIndex(new Date(s.start), tz);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  const counts = Array.from(
    { length: 12 },
    (_, i) => perWeek.get(thisWeek - 11 + i) ?? 0
  );
  const monthLabels: Array<{ index: number; label: string }> = [];
  let lastMonth = "";
  for (let i = 0; i < 12; i++) {
    const w = thisWeek - 11 + i;
    const monday = new Date((w * 7 - 3) * 86_400_000);
    const label = new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      month: "short",
    })
      .format(monday)
      .toUpperCase();
    if (label !== lastMonth && i <= 9) {
      monthLabels.push({ index: i, label });
      lastMonth = label;
    }
  }

  const typeCounts = DRINK_TYPES.map((t) => ({
    type: t,
    count: entries.filter((e) => e.drink_type === t).length,
  }));
  const maxType = Math.max(...typeCounts.map((t) => t.count), 1);
  const notesCount = entries.filter((e) => e.notes?.trim()).length;
  const legend = achievements.find((a) => a.id === "local_legend");

  return (
    <>
      {/* discovery hero */}
      <div className="section">
        <div className="h-row" style={{ marginBottom: 16 }}>
          <h3>All time</h3>
        </div>
        <div className="stats big">
          <div className="stat">
            <div className="label">Sessions</div>
            <div className="num">{sessions.length}</div>
          </div>
          <div className="stat">
            <div className="label">Venues</div>
            <div className="num">{venues.size}</div>
          </div>
          <div className="stat">
            <div className="label">Drinks tried</div>
            <div className="num">{drinksTried.size}</div>
          </div>
        </div>
      </div>

      {/* active-weeks streak, rest-week framing */}
      <div className="section">
        <div className="h-row" style={{ marginBottom: 2 }}>
          <h3>Active-weeks streak</h3>
        </div>
        <div className="stats" style={{ marginTop: 12 }}>
          <div className="stat">
            <div className="label">Current</div>
            <div className="num">
              {weeks.current}
              <small>wk</small>
            </div>
            <div className="sub">weeks with at least one session</div>
          </div>
          <div className="stat">
            <div className="label">Best</div>
            <div className="num">
              {weeks.best}
              <small>wk</small>
            </div>
            <div className="sub">your longest run so far</div>
          </div>
        </div>
        <div className="weeks">
          {weeks.strip.map((on, i) => (
            <div key={i} className={on ? "cell on" : "cell rest"}></div>
          ))}
        </div>
        <div className="weeks-legend">
          <span>
            <i className="on"></i> active week
          </span>
          <span>
            <i className="rest"></i> rest week — recovery counts, the streak
            survives it
          </span>
        </div>
      </div>

      {/* sessions per week */}
      <div className="section">
        <div
          className="label"
          style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 6 }}
        >
          Sessions per week · last 12 weeks
        </div>
        <SessionsPerWeekChart counts={counts} monthLabels={monthLabels} />
      </div>

      {/* discovery: types explored */}
      <div className="section">
        <div className="h-row" style={{ marginBottom: 8 }}>
          <h3>What you explore</h3>
        </div>
        {typeCounts.map(({ type, count }) => (
          <div className="barrow" key={type}>
            <span className="bl">{type}</span>
            <span className="track">
              <i style={{ width: `${Math.round((count / maxType) * 100)}%` }}></i>
            </span>
            <span className="bn">{count}</span>
          </div>
        ))}
        <div className="stats" style={{ marginTop: 18 }}>
          <div className="stat">
            <div className="label">Types tried</div>
            <div className="num">
              {typeCounts.filter((t) => t.count > 0).length}
            </div>
          </div>
          <div className="stat">
            <div className="label">Notes written</div>
            <div className="num">{notesCount}</div>
          </div>
          <div className="stat">
            <div className="label">Local Legend</div>
            <div className="num">{legend?.earned ? 1 : 0}</div>
          </div>
        </div>
      </div>

      {/* achievements teaser */}
      <div className="section">
        <div className="h-row">
          <h3>Achievements</h3>
          <Link href="/achievements">See all</Link>
        </div>
        {teaser.map((a) => (
          <Link
            key={a.id}
            href="/achievements"
            className="row"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="rowmark ach">
              <AchievementGlyph icon={a.icon} />
            </div>
            <div className="grow">
              <b>{a.label}</b>
              <span>{a.progressText}</span>
            </div>
            <span className="chev">›</span>
          </Link>
        ))}
      </div>
    </>
  );
}

function StatsBodySkeleton() {
  return (
    <div className="space-y-6 py-4">
      <SkeletonCard className="space-y-3">
        <Skeleton className="h-5 w-36" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5 text-center">
              <Skeleton className="h-8 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>
      </SkeletonCard>
      {[...Array(2)].map((_, i) => (
        <SkeletonCard key={i} className="space-y-3">
          <Skeleton className={i === 0 ? "h-5 w-28" : "h-5 w-32"} />
          <Skeleton className="h-48 rounded-lg" />
        </SkeletonCard>
      ))}
    </div>
  );
}
