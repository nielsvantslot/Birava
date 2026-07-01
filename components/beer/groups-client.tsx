"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateInviteCode } from "@/lib/utils";

interface GroupsClientProps {
  groups: Array<{ id: string; name: string; invite_code: string }>;
  userId: string;
}

export function GroupsClient({ groups, userId }: GroupsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    startTransition(async () => {
      const supabase = createClient();
      const code = generateInviteCode();
      const { data: group } = await supabase
        .from("groups")
        .insert({ name: newGroupName.trim(), invite_code: code })
        .select()
        .single();
      if (group) {
        await supabase.from("group_members").insert({
          group_id: group.id,
          user_id: userId,
        });
        // Update all future beer entries with this group
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
      const { data: group } = await supabase
        .from("groups")
        .select("id")
        .eq("invite_code", inviteCode.trim().toUpperCase())
        .single();
      if (group) {
        await supabase.from("group_members").upsert({
          group_id: group.id,
          user_id: userId,
        });
        setInviteCode("");
        router.refresh();
      } else {
        alert("Group not found. Check the invite code.");
      }
    });
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Existing groups */}
      {groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{group.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)] font-mono mt-0.5">
                      {group.invite_code}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyCode(group.invite_code, group.id)}
                    className="gap-1.5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copiedId === group.id ? "Copied!" : "Copy Code"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
