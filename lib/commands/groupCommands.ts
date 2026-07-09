import { db } from "@/lib/db";
import { generateInviteCode } from "@/lib/utils";
import {
  ActionResultDTO,
  CreateGroupDTO,
  DeleteGroupDTO,
  JoinGroupDTO,
  LeaveGroupDTO,
} from "@/lib/dtos";

export async function createGroup(ownerId: string, input: CreateGroupDTO): Promise<ActionResultDTO> {
  try {
    await db.group.create({
      data: {
        name: input.name.trim(),
        inviteCode: generateInviteCode(),
        ownerId,
        members: { create: { userId: ownerId } },
      },
    });
  } catch {
    return { error: "Failed to create group." };
  }

  return {};
}

export async function joinGroup(userId: string, input: JoinGroupDTO): Promise<ActionResultDTO> {
  const group = await db.group.findUnique({
    where: { inviteCode: input.inviteCode.trim().toUpperCase() },
  });
  if (!group) return { error: "Group not found" };

  await db.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId } },
    update: {},
    create: { groupId: group.id, userId },
  });

  return {};
}

export async function leaveGroup(userId: string, input: LeaveGroupDTO): Promise<ActionResultDTO> {
  const group = await db.group.findUnique({ where: { id: input.groupId } });
  if (!group) return { error: "Group not found" };
  if (group.ownerId === userId) {
    return { error: "Group owners cannot leave their own group" };
  }

  await db.groupMember.deleteMany({
    where: { groupId: input.groupId, userId },
  });

  return {};
}

export async function deleteGroup(ownerId: string, input: DeleteGroupDTO): Promise<ActionResultDTO> {
  const deleted = await db.group.deleteMany({
    where: { id: input.groupId, ownerId },
  });
  if (deleted.count === 0) {
    return { error: "Only the group owner can delete this group" };
  }

  return {};
}
