import { DrinkEntryDTO } from "@/lib/dtos";

export function getTodayDrinks(entries: DrinkEntryDTO[]) {
  const today = new Date();
  return entries
    .filter((e) => {
      const d = new Date(e.createdAt);
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    })
    .reduce((sum, e) => sum + e.amount, 0);
}

export function getStreak(entries: DrinkEntryDTO[]): number {
  if (!entries.length) return 0;
  const days = new Set(
    entries.map((e) => new Date(e.createdAt).toLocaleDateString())
  );
  const daysArr = Array.from(days).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  let streak = 0;
  const check = new Date();
  for (const day of daysArr) {
    const d = new Date(day);
    if (
      d.getDate() === check.getDate() &&
      d.getMonth() === check.getMonth() &&
      d.getFullYear() === check.getFullYear()
    ) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function getAvgPerDay(entries: DrinkEntryDTO[]): string {
  if (!entries.length) return "0";
  const days = new Set(
    entries.map((e) => new Date(e.createdAt).toLocaleDateString())
  );
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  return (total / days.size).toFixed(1);
}

export function getTopCategory(
  entries: DrinkEntryDTO[],
  selector: (entry: DrinkEntryDTO) => string | null
) {
  const scores = new Map<string, number>();

  for (const entry of entries) {
    const key = selector(entry);
    if (!key) continue;
    scores.set(key, (scores.get(key) ?? 0) + entry.amount);
  }

  let top: string | null = null;
  let topScore = 0;
  for (const [key, score] of scores.entries()) {
    if (score > topScore) {
      top = key;
      topScore = score;
    }
  }

  return top;
}
