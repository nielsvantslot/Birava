"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PluralFormatter } from "@/lib/format/pluralFormatter";
import { Avatar } from "@/components/ui/avatar";
import { UsernameLabel } from "@/components/ui/username-label";

export type LeaderboardRow = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isDeveloper: boolean;
  sessions: number;
  drinks: number;
  you: boolean;
};

/**
 * The live scoreboard inside a crew. Metric toggle re-ranks the board;
 * scores are since-joined, computed server-side.
 */
export function CrewLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const [metric, setMetric] = useState<"sessions" | "drinks">("sessions");

  const ranked = useMemo(
    () =>
      [...rows].sort((a, b) =>
        metric === "sessions"
          ? b.sessions - a.sessions || b.drinks - a.drinks
          : b.drinks - a.drinks || b.sessions - a.sessions
      ),
    [rows, metric]
  );

  return (
    <>
      <div className="metric-seg">
        <button
          className={cn("chip", metric === "sessions" && "on")}
          onClick={() => setMetric("sessions")}
        >
          Sessions
        </button>
        <button
          className={cn("chip", metric === "drinks" && "on")}
          onClick={() => setMetric("drinks")}
        >
          Drinks
        </button>
      </div>
      <div className="lb">
        {ranked.map((row, i) => (
          <div className={cn("lr", row.you && "you")} key={row.userId}>
            <div className={cn("rank", i === 0 && "top")}>{i + 1}</div>
            <div className="avatar">
              <Avatar userId={row.userId} username={row.username} avatarUrl={row.avatarUrl} />
            </div>
            <div className="grow">
              <UsernameLabel
                as="div"
                block
                name={<b>{row.you ? "You" : row.username}</b>}
                isDeveloper={row.isDeveloper}
              />
              <span>
                {row.sessions} session{PluralFormatter.suffix(row.sessions)} ·{" "}
                {row.drinks} drink{PluralFormatter.suffix(row.drinks)}
              </span>
            </div>
            <div className="score">
              {metric === "sessions" ? row.sessions : row.drinks}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
