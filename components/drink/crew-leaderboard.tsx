"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type LeaderboardRow = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  sessions: number;
  venues: number;
  you: boolean;
};

/**
 * The live scoreboard inside a crew. Metric toggle re-ranks the board;
 * scores are since-joined, computed server-side.
 */
export function CrewLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const [metric, setMetric] = useState<"sessions" | "venues">("sessions");

  const ranked = [...rows].sort((a, b) =>
    metric === "sessions"
      ? b.sessions - a.sessions || b.venues - a.venues
      : b.venues - a.venues || b.sessions - a.sessions
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
          className={cn("chip", metric === "venues" && "on")}
          onClick={() => setMetric("venues")}
        >
          Venues
        </button>
      </div>
      <div className="lb">
        {ranked.map((row, i) => (
          <div className={cn("lr", row.you && "you")} key={row.userId}>
            <div className={cn("rank", i === 0 && "top")}>{i + 1}</div>
            <div className="avatar">
              {row.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.avatarUrl} alt={row.username} />
              ) : (
                row.username.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="grow">
              <b>{row.you ? "You" : row.username}</b>
              <span>
                {row.sessions} session{row.sessions === 1 ? "" : "s"} ·{" "}
                {row.venues} venue{row.venues === 1 ? "" : "s"}
              </span>
            </div>
            <div className="score">
              {metric === "sessions" ? row.sessions : row.venues}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
