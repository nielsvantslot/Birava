import { getCurrentUser } from "@/modules/identity/server/session";
import { getUserTimeZone } from "@/lib/timezone";
import { getMyDrinkHistory } from "@/modules/checkins/server/drinkReads";
import { groupIntoSessions, activeWeeks } from "@/modules/sessions/domain/sessions";
import { computeAchievements } from "@/modules/achievements/domain/achievements";
import { AchievementsView } from "@/components/drink/achievements-view";

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

  return <AchievementsView weeks={weeks} achievements={achievements} />;
}
