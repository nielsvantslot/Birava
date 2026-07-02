"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, LogOut, Plus, Trash2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateInviteCode } from "@/lib/utils";

interface GroupsClientProps {
  groups: Array<{ id: string; name: string; invite_code: string; owner_id: string }>;
  userId: string;
}

export function GroupsClient({ groups, userId }: GroupsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeGroupAction, setActiveGroupAction] = useState<string | null>(null);

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

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const leaveGroup = (groupId: string, groupName: string) => {
    if (!window.confirm(`Leave ${groupName}?`)) return;

    startTransition(async () => {
      setActiveGroupAction(groupId);
      const supabase = createClient();
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", userId);

      setActiveGroupAction(null);

      if (error) {
        alert("Could not leave the group.");
        return;
      }

      router.refresh();
    });
  };

  const deleteGroup = (groupId: string, groupName: string) => {
    if (!window.confirm(`Delete ${groupName}? This cannot be undone.`)) return;

    startTransition(async () => {
      setActiveGroupAction(groupId);
      const supabase = createClient();
      const { error } = await supabase.rpc("delete_owned_group", {
        target_group_id: groupId,
      });

      setActiveGroupAction(null);

      if (error) {
        alert("Could not delete the group.");
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Existing groups */}
      {groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((group) => {
            const isOwner = group.owner_id === userId;
            const isActingOnGroup = activeGroupAction === group.id;

            return (
              <Card key={group.id}>
                <CardContent className="py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{group.name}</p>
                        {isOwner && <Badge variant="secondary">owner</Badge>}
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] font-mono mt-0.5">
                        {group.invite_code}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyCode(group.invite_code, group.id)}
                        className="gap-1.5"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copiedId === group.id ? "Copied!" : "Copy Code"}
                      </Button>
                      {isOwner ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isPending && isActingOnGroup}
                          onClick={() => deleteGroup(group.id, group.name)}
                          className="gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Group
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending && isActingOnGroup}
                          onClick={() => leaveGroup(group.id, group.name)}
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
          })}
        </div>
      )}

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
