"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/utils";

function revalidateGroupPaths() {
  revalidatePath("/leaderboard");
  revalidatePath("/leaderboard", "layout");
}

export async function createGroup(name: string): Promise<{ error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const supabase = await createClient();
  const groupId = crypto.randomUUID();

  const { error: createGroupError } = await supabase.from("groups").insert({
    id: groupId,
    name: name.trim(),
    invite_code: generateInviteCode(),
    owner_id: user.id,
  });

  if (createGroupError) return { error: createGroupError.message };

  const { error: addOwnerError } = await supabase.from("group_members").insert({
    group_id: groupId,
    user_id: user.id,
  });

  if (addOwnerError) {
    await supabase.rpc("delete_owned_group", { target_group_id: groupId });
    return { error: addOwnerError.message };
  }

  revalidateGroupPaths();
  return {};
}

export async function joinGroupByInvite(inviteCode: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_group_by_invite_code", {
    invite: inviteCode.trim().toUpperCase(),
  });

  if (error) return { error: error.message };
  revalidateGroupPaths();
  return {};
}

export async function leaveGroup(targetGroupId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_group", {
    target_group_id: targetGroupId,
  });

  if (error) return { error: error.message };
  revalidateGroupPaths();
  return {};
}

export async function deleteOwnedGroup(targetGroupId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_owned_group", {
    target_group_id: targetGroupId,
  });

  if (error) return { error: error.message };
  revalidateGroupPaths();
  return {};
}
