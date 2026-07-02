"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateInviteCode } from "@/lib/utils";

interface BoardGroupsClientProps {
  groups: Array<{ id: string; name: string; invite_code: string; owner_id: string | null }>;
  userId: string;
  hasFriends: boolean;
}

export function BoardGroupsClient({ groups, userId, hasFriends }: BoardGroupsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    startTransition(async () => {
      const supabase = createClient();
      const code = generateInviteCode();
      const groupId = crypto.randomUUID();
      const { error: createGroupError } = await supabase
        .from("groups")
        .insert({ id: groupId, name: newGroupName.trim(), invite_code: code, owner_id: userId });

      if (createGroupError) {
        alert("Could not create the group.");
        return;
      }

      const { error: addOwnerError } = await supabase.from("group_members").insert({
        group_id: groupId,
        user_id: userId,
      });

      if (addOwnerError) {
        await supabase.rpc("delete_owned_group", { target_group_id: groupId });
        alert("Could not create the group.");
        return;
      }

      setNewGroupName("");
      router.refresh();
    });
  };

  const joinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("join_group_by_invite_code", {
        invite: inviteCode.trim().toUpperCase(),
      });
      if (error) {
        alert("Group not found. Check the invite code.");
        return;
      }
      setInviteCode("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Friends */}
      {hasFriends && (
        <div>
          <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">
            Friends
          </p>
          <Link href="/leaderboard/friends">
            <Card className="hover:border-[var(--primary)] transition-colors cursor-pointer">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👥</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">Friends</p>
                    <p className="text-xs text-[var(--muted-foreground)]">People you follow</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[var(--muted-foreground)]" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* Groups */}
      <div>
        <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">
          Groups
        </p>
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="text-4xl mb-3">🍺</span>
            <p className="font-semibold">No groups yet</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Create or join a group below.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => {
              const isOwner = group.owner_id === userId;
              return (
                <Link key={group.id} href={`/leaderboard/${group.id}`}>
                  <Card className="hover:border-[var(--primary)] transition-colors cursor-pointer">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🍺</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">{group.name}</p>
                            {isOwner && <Badge variant="secondary">owner</Badge>}
                          </div>
                          <p className="text-xs text-[var(--muted-foreground)] font-mono">
                            {group.invite_code}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-[var(--muted-foreground)]" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Create group */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-[var(--primary)]" />
            Create a Group
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createGroup} className="flex gap-2">
            <Input
              placeholder="Holiday name..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <Button type="submit" disabled={isPending || !newGroupName.trim()}>
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Join group */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-[var(--primary)]" />
            Join a Group
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={joinGroup} className="flex gap-2">
            <Input
              placeholder="Enter invite code..."
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="font-mono uppercase"
              maxLength={6}
            />
            <Button type="submit" disabled={isPending || !inviteCode.trim()}>
              Join
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
