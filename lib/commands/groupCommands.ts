import { db } from "@/lib/db";
import { generateInviteCode } from "@/lib/utils";
import { queueNotifications } from "@/lib/notify";
import {
  ActionResultDTO,
  CreateGroupDTO,
  CreateGroupResultDTO,
  JoinGroupDTO,
  JoinGroupResultDTO,
  LeaveGroupDTO,
} from "@/lib/dtos";

export async function createGroup(
  ownerId: string,
  input: CreateGroupDTO
): Promise<CreateGroupResultDTO> {
  let group;
  try {
    group = await db.group.create({
      data: {
        name: input.name.trim(),
        inviteCode: generateInviteCode(),
        ownerId,
        members: { create: { userId: ownerId } },
      },
    });
  } catch {
    return { error: "Failed to create crew." };
  }

  return { inviteCode: group.inviteCode };
}

export async function joinGroup(
  userId: string,
  input: JoinGroupDTO,
  actor: { username: string; avatarUrl: string | null }
): Promise<JoinGroupResultDTO> {
  const group = await db.group.findUnique({
    where: { inviteCode: input.inviteCode.trim().toUpperCase() },
  });
  if (!group) return { error: "That code doesn't match any crew." };

  const existingMembers = await db.groupMember.findMany({
    where: { groupId: group.id },
    select: { userId: true },
  });
  const alreadyMember = existingMembers.some((m) => m.userId === userId);

  await db.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId } },
    update: {},
    create: { groupId: group.id, userId },
  });

  if (!alreadyMember) {
    queueNotifications(
      existingMembers.map((m) => ({
        userId: m.userId,
        type: "CREW_JOIN" as const,
        actorId: userId,
        actorUsername: actor.username,
        actorAvatarUrl: actor.avatarUrl,
        groupId: group.id,
        groupName: group.name,
      }))
    );
  }

  return { groupName: group.name };
}

export async function leaveGroup(userId: string, input: LeaveGroupDTO): Promise<ActionResultDTO> {
  const group = await db.group.findUnique({ where: { id: input.groupId } });
  if (!group) return { error: "Crew not found" };
  if (group.ownerId === userId) {
    return { error: "Crew owners can't leave their own crew" };
  }

  await db.groupMember.deleteMany({
    where: { groupId: input.groupId, userId },
  });

  return {};
}
