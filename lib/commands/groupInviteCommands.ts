import { db } from "@/lib/db";
import { queueNotifications } from "@/lib/notify";
import { getFollowingIds, getFollowerIds } from "@/lib/queries/followQueries";
import { ActionResultDTO, SendCrewInviteDTO, RespondToCrewInviteDTO } from "@/lib/dtos";

async function isMutualFollow(a: string, b: string): Promise<boolean> {
  const [aFollowsB, bFollowsA] = await Promise.all([
    getFollowingIds(a).then((ids) => ids.includes(b)),
    getFollowerIds(a).then((ids) => ids.includes(b)),
  ]);
  return aFollowsB && bFollowsA;
}

/**
 * Sends a pending crew invite — not an immediate membership. Gated the same
 * way as sharing the invite code (#162): any member when the crew is
 * PUBLIC, owner/admin only when PRIVATE. Candidates are mutual follows only.
 */
export async function sendCrewInvite(
  actorId: string,
  input: SendCrewInviteDTO,
  actor: { username: string; avatarUrl: string | null }
): Promise<ActionResultDTO> {
  const group = await db.group.findUnique({
    where: { id: input.groupId },
    include: { members: { select: { userId: true, role: true } } },
  });
  if (!group) return { error: "Crew not found" };

  const actorMembership = group.members.find((m) => m.userId === actorId);
  if (!actorMembership) return { error: "You're not a member of this crew" };
  if (group.visibility === "PRIVATE" && actorMembership.role === "MEMBER") {
    return { error: "Only the owner or an admin can invite to a private crew" };
  }
  if (group.members.some((m) => m.userId === input.invitedUserId)) {
    return { error: "Already a member of this crew" };
  }

  const mutual = await isMutualFollow(actorId, input.invitedUserId);
  if (!mutual) return { error: "You can only invite people you mutually follow" };

  const existingPending = await db.groupInvite.findFirst({
    where: { groupId: input.groupId, invitedUserId: input.invitedUserId, status: "PENDING" },
  });
  if (existingPending) return { error: "Already invited — waiting on a response" };

  const invite = await db.groupInvite.create({
    data: { groupId: input.groupId, invitedUserId: input.invitedUserId, invitedById: actorId },
  });

  queueNotifications([
    {
      userId: input.invitedUserId,
      type: "CREW_INVITE",
      actorId,
      actorUsername: actor.username,
      actorAvatarUrl: actor.avatarUrl,
      // The invite's own id — describeNotification/the notifications UI
      // reuse the generic entryId field to key the accept/decline action,
      // same convention CREW_CHECKIN/SESSION_START use for a session id.
      entryId: invite.id,
      groupId: group.id,
      groupName: group.name,
    },
  ]);

  return {};
}

/**
 * Accept creates the GroupMember row (same as entering an invite code by
 * hand) and clears any prior GroupBan — an explicit invite+accept is the
 * "owner/admin explicitly re-adds them" path #162 left open for lifting a
 * kick. Decline just updates status; neither notifies the inviter.
 */
export async function respondToCrewInvite(
  userId: string,
  input: RespondToCrewInviteDTO,
  actor: { username: string; avatarUrl: string | null }
): Promise<ActionResultDTO> {
  const invite = await db.groupInvite.findUnique({ where: { id: input.inviteId } });
  if (!invite || invite.invitedUserId !== userId) return { error: "Invite not found" };
  if (invite.status !== "PENDING") return { error: "This invite has already been responded to" };

  if (!input.accept) {
    await db.groupInvite.update({ where: { id: invite.id }, data: { status: "DECLINED" } });
    return {};
  }

  const existingMembers = await db.groupMember.findMany({
    where: { groupId: invite.groupId },
    select: { userId: true },
  });

  await db.$transaction([
    db.groupInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } }),
    db.groupBan.deleteMany({ where: { groupId: invite.groupId, userId } }),
    db.groupMember.upsert({
      where: { groupId_userId: { groupId: invite.groupId, userId } },
      update: {},
      create: { groupId: invite.groupId, userId },
    }),
  ]);

  const group = await db.group.findUnique({ where: { id: invite.groupId } });
  if (group) {
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

  return {};
}
