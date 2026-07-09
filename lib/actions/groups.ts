"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { generateInviteCode } from "@/lib/utils";

function revalidateGroupPaths() {
  revalidatePath("/leaderboard");
  revalidatePath("/leaderboard", "layout");
}

export async function createGroup(name: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await db.group.create({
      data: {
        name: name.trim(),
        inviteCode: generateInviteCode(),
        ownerId: user.id,
        members: { create: { userId: user.id } },
      },
    });
  } catch {
    return { error: "Failed to create group." };
  }

  revalidateGroupPaths();
  return {};
}

export async function joinGroupByInvite(inviteCode: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const group = await db.group.findUnique({
    where: { inviteCode: inviteCode.trim().toUpperCase() },
  });
  if (!group) return { error: "Group not found" };

  await db.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    update: {},
    create: { groupId: group.id, userId: user.id },
  });

  revalidateGroupPaths();
  return {};
}

export async function leaveGroup(targetGroupId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const group = await db.group.findUnique({ where: { id: targetGroupId } });
  if (!group) return { error: "Group not found" };
  if (group.ownerId === user.id) {
    return { error: "Group owners cannot leave their own group" };
  }

  await db.groupMember.deleteMany({
    where: { groupId: targetGroupId, userId: user.id },
  });

  revalidateGroupPaths();
  return {};
}

export async function deleteOwnedGroup(targetGroupId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const deleted = await db.group.deleteMany({
    where: { id: targetGroupId, ownerId: user.id },
  });
  if (deleted.count === 0) {
    return { error: "Only the group owner can delete this group" };
  }

  revalidateGroupPaths();
  return {};
}
