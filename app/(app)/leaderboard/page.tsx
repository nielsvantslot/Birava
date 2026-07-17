import { redirect } from "next/navigation";

// "Leaderboard" is the ranking inside a crew, not a place — see /crews
export default function LeaderboardPage() {
  redirect("/crews");
}
