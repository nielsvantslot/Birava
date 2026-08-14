import { AchievementGlyph } from "@/components/drink/achievement-icon";
import { ActiveWeeksStreak } from "@/components/drink/active-weeks-streak";
import { cn } from "@/lib/utils";
import type { ActiveWeeks } from "@/lib/sessions";
import type { VarietyAchievement } from "@/lib/achievements";

/**
 * The full achievements page body — streak section + variety grid.
 * Extracted from app/(app)/achievements/page.tsx as a pure presentational
 * component, so the data-fetching page and this rendering stay separately
 * testable/reusable.
 */
export function AchievementsView({
  weeks,
  achievements,
}: {
  weeks: ActiveWeeks;
  achievements: VarietyAchievement[];
}) {
  return (
    <>
      {/* active-weeks streak, with recovery framing */}
      <div className="section">
        <div className="h-row" style={{ marginBottom: 2 }}>
          <h3>Active-weeks streak</h3>
        </div>
        <ActiveWeeksStreak weeks={weeks} showRestWeekCallout />
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
