"use server";

import { revalidatePath } from "next/cache";
import { gateway } from "@/modules/identity/server/gateway";
import {
  createGroup as createGroupCommand,
  joinGroup,
  leaveGroup as leaveGroupCommand,
  setCrewVisibility as setCrewVisibilityCommand,
  renameGroup as renameGroupCommand,
  regenerateInviteCode as regenerateInviteCodeCommand,
  setMemberRole as setMemberRoleCommand,
  kickMember as kickMemberCommand,
  unbanMember as unbanMemberCommand,
  closeGroup as closeGroupCommand,
  deleteGroup as deleteGroupCommand,
} from "@/modules/crews/application/groupCommands";
import {
  sendCrewInvite as sendCrewInviteCommand,
  respondToCrewInvite as respondToCrewInviteCommand,
} from "@/modules/crews/application/groupInviteCommands";
import {
  createCrewInput,
  crewIdInput,
  crewMemberInput,
  joinCrewInput,
  renameCrewInput,
  respondToCrewInviteInput,
  sendCrewInviteInput,
  setCrewVisibilityInput,
  setMemberRoleInput,
} from "@/modules/crews/contract/crewContract";

// Mutations only: reads live in modules/crews/server/crewReads.ts (a Server Action is a public POST endpoint).

const GROUP_PATHS = ["/crews"];

function revalidateGroupPaths(): string[] {
  revalidatePath("/crews");
  revalidatePath("/crews", "layout");
  return GROUP_PATHS;
}

/** Runs a crew command and, on success, folds the revalidated crew paths into its result. */
async function withGroupRevalidation<T extends { error?: string; revalidatedPaths?: string[] }>(result: T): Promise<T> {
  if (!result.error) result.revalidatedPaths = revalidateGroupPaths();
  return result;
}

export const createGroup = gateway.action.authed(
  { name: "crews.create", input: createCrewInput },
  async ({ user, input }) => withGroupRevalidation(await createGroupCommand(user.id, input))
);

export const joinGroupByInvite = gateway.action.authed(
  {
    name: "crews.join",
    input: joinCrewInput,
    // 6-char base36 invite codes make brute-forcing impractical at any
    // reasonable rate, but capping attempts is cheap insurance regardless.
    rateLimit: {
      bucket: "join-crew",
      limit: 20,
      windowMs: 10 * 60 * 1000,
      scope: "user",
      message: "Too many attempts — try again in a few minutes.",
    },
  },
  async ({ user, input }) =>
    withGroupRevalidation(
      await joinGroup(user.id, input, {
        username: user.username,
        avatarUrl: user.avatarUrl,
      })
    )
);

export const leaveGroup = gateway.action.authed(
  { name: "crews.leave", input: crewIdInput },
  async ({ user, input }) => withGroupRevalidation(await leaveGroupCommand(user.id, input))
);

export const setCrewVisibility = gateway.action.authed(
  { name: "crews.set-visibility", input: setCrewVisibilityInput },
  async ({ user, input }) => withGroupRevalidation(await setCrewVisibilityCommand(user.id, input))
);

export const renameGroup = gateway.action.authed(
  { name: "crews.rename", input: renameCrewInput },
  async ({ user, input }) => withGroupRevalidation(await renameGroupCommand(user.id, input))
);

export const regenerateInviteCode = gateway.action.authed(
  { name: "crews.regenerate-invite-code", input: crewIdInput },
  async ({ user, input }) => withGroupRevalidation(await regenerateInviteCodeCommand(user.id, input))
);

export const setMemberRole = gateway.action.authed(
  { name: "crews.set-member-role", input: setMemberRoleInput },
  async ({ user, input }) => withGroupRevalidation(await setMemberRoleCommand(user.id, input))
);

export const kickMember = gateway.action.authed(
  { name: "crews.kick-member", input: crewMemberInput },
  async ({ user, input }) => withGroupRevalidation(await kickMemberCommand(user.id, input))
);

export const unbanMember = gateway.action.authed(
  { name: "crews.unban-member", input: crewMemberInput },
  async ({ user, input }) => withGroupRevalidation(await unbanMemberCommand(user.id, input))
);

export const sendCrewInvite = gateway.action.authed(
  { name: "crews.send-invite", input: sendCrewInviteInput },
  async ({ user, input }) =>
    sendCrewInviteCommand(user.id, input, {
      username: user.username,
      avatarUrl: user.avatarUrl,
    })
);

export const respondToCrewInvite = gateway.action.authed(
  { name: "crews.respond-to-invite", input: respondToCrewInviteInput },
  async ({ user, input }) => {
    const result = await respondToCrewInviteCommand(user.id, input, {
      username: user.username,
      avatarUrl: user.avatarUrl,
    });
    if (!result.error) {
      revalidatePath("/notifications");
      result.revalidatedPaths = ["/notifications", ...revalidateGroupPaths()];
    }
    return result;
  }
);

export const closeGroup = gateway.action.authed(
  { name: "crews.close", input: crewIdInput },
  async ({ user, input }) => withGroupRevalidation(await closeGroupCommand(user.id, input))
);

export const deleteGroup = gateway.action.authed(
  { name: "crews.delete", input: crewIdInput },
  async ({ user, input }) => withGroupRevalidation(await deleteGroupCommand(user.id, input))
);
