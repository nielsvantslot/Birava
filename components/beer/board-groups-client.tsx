"use client";

import { useState } from "react";
import { GroupsClient } from "@/components/beer/groups-client";
import { LeaderboardClient, LeaderboardTab } from "@/components/beer/leaderboard-client";

interface BoardGroupsClientProps {
  tabs: LeaderboardTab[];
  groups: Array<{ id: string; name: string; invite_code: string; owner_id: string | null }>;
  userId: string;
}

export function BoardGroupsClient({ tabs, groups, userId }: BoardGroupsClientProps) {
  const initialTabId = groups[0]?.id ?? tabs[0]?.id ?? "";
  const [selectedTabId, setSelectedTabId] = useState(initialTabId);

  const selectedGroupId = groups.some((group) => group.id === selectedTabId)
    ? selectedTabId
    : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-6 pt-2">
        <div>
          <h2 className="text-xl font-black">Groups 👥</h2>
          <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
            Create, join, and tap a group to see its leaderboard
          </p>
        </div>

        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="text-6xl mb-4">👥</span>
            <p className="font-semibold text-lg">No groups yet</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Create a group or join one with an invite code.
            </p>
          </div>
        )}

        <GroupsClient
          groups={groups}
          userId={userId}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedTabId}
        />
      </div>

      <div>
        <h2 className="text-xl font-black">Leaderboard 🏆</h2>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
          Rankings for your selected group
        </p>
      </div>

      <LeaderboardClient
        tabs={tabs}
        currentUserId={userId}
        selectedTabId={selectedTabId}
        onSelectedTabIdChange={setSelectedTabId}
      />
    </div>
  );
}
