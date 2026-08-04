import Link from "next/link";
import { AchievementGlyph } from "@/components/drink/achievement-icon";
import type { VarietyAchievement } from "@/lib/achievements";

interface AchievementBadgeStripProps {
  achievements: VarietyAchievement[];
  /**
   * The viewer's own profile links each chip to /achievements and shows the
   * locked state; a public profile passes only earned achievements and
   * doesn't link, since /achievements is the owner's own page, not the
   * visited user's.
   */
  linked?: boolean;
}

export function AchievementBadgeStrip({ achievements, linked = false }: AchievementBadgeStripProps) {
  return (
    <div className="badge-strip">
      {achievements.map((a) => {
        const content = (
          <>
            <div className="ac-ic">
              <AchievementGlyph icon={a.icon} />
            </div>
            <span>{a.label}</span>
          </>
        );
        return linked ? (
          <Link
            key={a.id}
            href="/achievements"
            className={`badge-chip${a.earned ? "" : " locked"}`}
            prefetch={false}
          >
            {content}
          </Link>
        ) : (
          <div key={a.id} className="badge-chip">
            {content}
          </div>
        );
      })}
    </div>
  );
}
