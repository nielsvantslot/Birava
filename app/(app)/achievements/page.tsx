import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { getMyDrinkHistory } from "@/lib/controllers/drinkController";
import { groupIntoSessions, activeWeeks } from "@/lib/sessions";
import { computeAchievements } from "@/lib/achievements";
import { AchievementGlyph } from "@/components/beer/achievement-icon";
import { cn } from "@/lib/utils";

export default async function AchievementsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [tz, entries] = await Promise.all([
    getUserTimeZone(),
    getMyDrinkHistory(),
  ]);
  const sessions = groupIntoSessions(entries);
  const weeks = activeWeeks(sessions, tz);
  const achievements = computeAchievements(entries, tz);

  return (
    <>
      {/* active-weeks streak, with recovery framing */}
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
            <div className="sub">your longest run</div>
          </div>
        </div>
        <div className="weeks">
          {weeks.strip.map((on, i) => (
            <div key={i} className={on ? "cell on" : "cell rest"}></div>
          ))}
        </div>
        <div className="weeks-legend">
          <span>
            <i className="on"></i> active
          </span>
          <span>
            <i className="rest"></i> rest week
          </span>
        </div>
        <div className="callout" style={{ margin: "16px 0 0" }}>
          <div className="mark" style={{ color: "var(--accent)" }}>
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
              <path d="M12 21c4-3.5 6-6.6 6-9.5C18 7 15.5 4 12 4S6 7 6 11.5c0 2.9 2 6 6 9.5z"></path>
              <path d="M9 11.5l2 2 4-4"></path>
            </svg>
          </div>
          <div>
            <b>A rest week won&apos;t break it</b>
            <p>
              The streak counts weeks with at least one session — never
              consecutive days. Skip a week and it reads as recovery, not a
              failure. Birava will never nudge you to drink to keep a number
              alive.
            </p>
          </div>
        </div>
      </div>

      {/* variety achievements */}
      <div className="section">
        <div className="h-row" style={{ marginBottom: 4 }}>
          <h3>Discovery</h3>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 14 }}>
          Every badge rewards variety — new types, venues, places — never how
          much you drink.
        </p>
        <div className="ach-grid">
          {achievements.map((a) => (
            <div key={a.id} className={cn("ach-card", !a.earned && a.progress === 0 && "locked")}>
              <div className="ac-ic">
                <AchievementGlyph icon={a.icon} />
              </div>
              <b>{a.label}</b>
              <p>{a.description}</p>
              <div className="prog">
                <i
                  style={{
                    width: `${Math.round((a.progress / a.goal) * 100)}%`,
                  }}
                ></i>
              </div>
              <div className="pt">{a.progressText}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
