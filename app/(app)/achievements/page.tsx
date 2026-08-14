import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { getMyDrinkHistory } from "@/lib/controllers/drinkController";
import { groupIntoSessions, activeWeeks } from "@/lib/sessions";
import { computeAchievements } from "@/lib/achievements";
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
