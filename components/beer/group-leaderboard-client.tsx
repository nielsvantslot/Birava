"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  deleteOwnedGroup,
  leaveGroup as leaveGroupAction,
} from "@/lib/actions/groups";

interface GroupLeaderboardClientProps {
  group: { id: string; name: string; invite_code: string; owner_id: string | null };
  currentUserId: string;
}

export function GroupLeaderboardClient({ group, currentUserId }: GroupLeaderboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const isOwner = group.owner_id === currentUserId;

  const copyCode = () => {
    navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveGroup = () => {
    if (!window.confirm(`Leave ${group.name}?`)) return;
    startTransition(async () => {
      const result = await leaveGroupAction(group.id);
      if (result.error) {
        alert("Could not leave the group.");
        return;
      }
      router.push("/leaderboard");
    });
  };

  const deleteGroup = () => {
    if (!window.confirm(`Delete ${group.name}? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteOwnedGroup(group.id);
      if (result.error) {
        alert("Could not delete the group.");
        return;
      }
      router.push("/leaderboard");
    });
  };

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{group.name}</p>
              {isOwner && <Badge variant="secondary">owner</Badge>}
            </div>
            <p className="text-xs text-[var(--muted-foreground)] font-mono mt-0.5">
              {group.invite_code}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyCode} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy Code"}
            </Button>
            {isOwner ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={isPending}
                onClick={deleteGroup}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Group
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                  onClick={handleLeaveGroup}
                className="gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                Leave Group
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
