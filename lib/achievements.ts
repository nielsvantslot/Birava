import { ACHIEVEMENTS } from "@/lib/types";

export function checkAchievements(totalBeers: number): boolean {
  return ACHIEVEMENTS.some((a) => a.threshold === totalBeers);
}

export function triggerConfetti() {
  if (typeof window === "undefined") return;
  import("canvas-confetti").then((module) => {
    const confetti = module.default;
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#f97316", "#fb923c", "#fbbf24", "#34d399", "#60a5fa"],
    });
  });
}

export function getEarnedAchievements(totalBeers: number) {
  return ACHIEVEMENTS.filter((a) => totalBeers >= a.threshold);
}
