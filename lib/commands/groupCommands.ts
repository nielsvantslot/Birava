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
  SetCrewVisibilityDTO,
  SetMemberRoleDTO,
  KickMemberDTO,
  UnbanMemberDTO,
  CloseGroupDTO,
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
        members: { create: { userId: ownerId, role: "OWNER" } },
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

  const banned = await db.groupBan.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
  });
  if (banned) {
    return { error: "You were removed from this crew and can't rejoin with this code." };
  }

  const existingMembers = await db.groupMember.findMany({
    where: { groupId: group.id },
    select: { userId: true },
  });
  const alreadyMember = existingMembers.some((m) => m.userId === userId);

  if (group.closedAt && !alreadyMember) {
    return { error: "This crew is closed and isn't accepting new members." };
  }

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

/** Owner-only: PUBLIC lets any member share/see the invite code; PRIVATE limits that to owner + admins. */
export async function setCrewVisibility(userId: string, input: SetCrewVisibilityDTO): Promise<ActionResultDTO> {
  const group = await db.group.findUnique({ where: { id: input.groupId } });
  if (!group) return { error: "Crew not found" };
  if (group.ownerId !== userId) return { error: "Only the crew owner can change visibility" };

  await db.group.update({
    where: { id: input.groupId },
    data: { visibility: input.visibility },
  });

  return {};
}

/**
 * Owner-only: stops new check-ins from counting toward the crew's
 * leaderboard from this point on (scoreCrew's closedAt upper bound) and
 * blocks new members from joining. Doesn't touch existing stats/members —
 * everyone keeps logging normally everywhere else in the app.
 */
export async function closeGroup(userId: string, input: CloseGroupDTO): Promise<ActionResultDTO> {
  const group = await db.group.findUnique({ where: { id: input.groupId } });
  if (!group) return { error: "Crew not found" };
  if (group.ownerId !== userId) {
    return { error: "Only the crew owner can close it" };
  }
  if (group.closedAt) return { error: "Crew is already closed" };

  await db.group.update({
    where: { id: input.groupId },
    data: { closedAt: new Date() },
  });

  return {};
}

/** Owner-only: promote a member to admin, or demote an admin back to member. The owner's own role can't be changed this way. */
export async function setMemberRole(userId: string, input: SetMemberRoleDTO): Promise<ActionResultDTO> {
  const group = await db.group.findUnique({ where: { id: input.groupId } });
  if (!group) return { error: "Crew not found" };
  if (group.ownerId !== userId) return { error: "Only the crew owner can change roles" };
  if (input.userId === group.ownerId) return { error: "The owner's role can't be changed" };

  const target = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId: input.groupId, userId: input.userId } },
  });
  if (!target) return { error: "That person isn't a member of this crew" };

  await db.groupMember.update({
    where: { groupId_userId: { groupId: input.groupId, userId: input.userId } },
    data: { role: input.role },
  });

  return {};
}

/**
 * Owner or admin: removes a member and bans them from rejoining via the
 * existing invite code (joinGroup checks GroupBan). Admins can kick plain
 * members but not the owner or other admins — only the owner can do that.
 */
export async function kickMember(userId: string, input: KickMemberDTO): Promise<ActionResultDTO> {
  const group = await db.group.findUnique({ where: { id: input.groupId } });
  if (!group) return { error: "Crew not found" };
  if (input.userId === group.ownerId) return { error: "The crew owner can't be kicked" };

  const actorIsOwner = group.ownerId === userId;
  if (!actorIsOwner) {
    const actor = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: input.groupId, userId } },
    });
    if (!actor || actor.role !== "ADMIN") {
      return { error: "Only the crew owner or an admin can remove members" };
    }
    const target = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: input.groupId, userId: input.userId } },
    });
    if (target?.role === "ADMIN") {
      return { error: "Only the crew owner can remove an admin" };
    }
  }

  await db.$transaction([
    db.groupMember.deleteMany({ where: { groupId: input.groupId, userId: input.userId } }),
    db.groupBan.upsert({
      where: { groupId_userId: { groupId: input.groupId, userId: input.userId } },
      update: { bannedAt: new Date() },
      create: { groupId: input.groupId, userId: input.userId },
    }),
  ]);

  return {};
}

/** Owner-only: lifts a previous kick so the user can rejoin via the invite code again. */
export async function unbanMember(userId: string, input: UnbanMemberDTO): Promise<ActionResultDTO> {
  const group = await db.group.findUnique({ where: { id: input.groupId } });
  if (!group) return { error: "Crew not found" };
  if (group.ownerId !== userId) return { error: "Only the crew owner can lift a removal" };

  await db.groupBan.deleteMany({ where: { groupId: input.groupId, userId: input.userId } });

  return {};
}
