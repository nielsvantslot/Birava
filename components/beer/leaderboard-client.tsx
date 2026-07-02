"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeaderboardEntry } from "@/lib/types";

export type LeaderboardTab = {
  id: string;
  label: string;
  entries: LeaderboardEntry[];
};

interface LeaderboardClientProps {
  tabs: LeaderboardTab[];
  currentUserId: string;
}

const medals = ["🥇", "🥈", "🥉"];

function LeaderboardList({
  entries,
  currentUserId,
}: {
  entries: LeaderboardEntry[];
  currentUserId: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="text-5xl mb-3">🍺</span>
        <p className="font-semibold text-lg">No entries yet</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Be the first to log a beer!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <Card
          key={entry.user_id}
          className={
            entry.user_id === currentUserId
              ? "border-[var(--primary)] bg-[var(--primary)]/5"
              : ""
          }
        >
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl w-8 text-center">
                {medals[index] ?? `#${index + 1}`}
              </span>
              <Avatar className="h-10 w-10">
                {entry.avatar_url && <AvatarFallback>{entry.username[0]?.toUpperCase()}</AvatarFallback>}
                {entry.avatar_url && <AvatarImage src={entry.avatar_url} />}
                {!entry.avatar_url && (
                  <AvatarFallback>{entry.username[0]?.toUpperCase()}</AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate">{entry.username}</p>
                  {entry.user_id === currentUserId && (
                    <Badge variant="secondary" className="text-xs">you</Badge>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Today: {entry.today} · Avg: {entry.avg_per_day}/day
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-[var(--primary)]">
                  {entry.total}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">beers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function LeaderboardClient({ tabs, currentUserId }: LeaderboardClientProps) {
  const [selectedTabId, setSelectedTabId] = useState(tabs[0]?.id ?? "");

  if (tabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-6xl mb-4">🏆</span>
        <p className="font-semibold text-lg">No friends or groups yet</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Follow friends or join a group to see the leaderboard.
        </p>
      </div>
    );
  }

  if (tabs.length === 1) {
    return (
      <LeaderboardList entries={tabs[0].entries} currentUserId={currentUserId} />
    );
  }

  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) ?? tabs[0];

  return (
    <div className="space-y-4">
      <Select value={selectedTab.id} onValueChange={setSelectedTabId}>
        <SelectTrigger aria-label="Select leaderboard">
          <SelectValue placeholder="Select leaderboard" />
        </SelectTrigger>
        <SelectContent>
          {tabs.map((tab) => (
            <SelectItem key={tab.id} value={tab.id}>
              {tab.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <LeaderboardList entries={selectedTab.entries} currentUserId={currentUserId} />
    </div>
  );
}
