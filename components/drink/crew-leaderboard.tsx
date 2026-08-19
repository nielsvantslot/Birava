"use client";

import { useState } from "react";
import { avatarSrc, cn } from "@/lib/utils";
import { DevBadge } from "@/components/ui/dev-badge";

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

  const ranked = [...rows].sort((a, b) =>
    metric === "sessions"
      ? b.sessions - a.sessions || b.drinks - a.drinks
      : b.drinks - a.drinks || b.sessions - a.sessions
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
              {row.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc(row.userId)} alt={row.username} />
              ) : (
                row.username.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="grow">
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <b>{row.you ? "You" : row.username}</b>
                {row.isDeveloper && <DevBadge />}
              </div>
              <span>
                {row.sessions} session{row.sessions === 1 ? "" : "s"} ·{" "}
                {row.drinks} drink{row.drinks === 1 ? "" : "s"}
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
