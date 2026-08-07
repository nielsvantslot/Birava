"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { NOT_AUTHENTICATED } from "@/lib/auth/authErrors";
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
} from "@/lib/commands/groupCommands";
import {
  sendCrewInvite as sendCrewInviteCommand,
  respondToCrewInvite as respondToCrewInviteCommand,
} from "@/lib/commands/groupInviteCommands";
import {
  getCrewSummariesForUser,
  getCrewDetailForViewer,
  type CrewSummary,
  type CrewDetail,
} from "@/lib/queries/groupQueries";
import { getCrewInviteCandidates as getCrewInviteCandidatesQuery } from "@/lib/queries/groupInviteQueries";
import {
  ActionResultDTO,
  CreateGroupDTO,
  CreateGroupResultDTO,
  GetCrewDTO,
  JoinGroupDTO,
  JoinGroupResultDTO,
  LeaveGroupDTO,
  SetCrewVisibilityDTO,
  RenameGroupDTO,
  RegenerateInviteCodeDTO,
  RegenerateInviteCodeResultDTO,
  SetMemberRoleDTO,
  KickMemberDTO,
  UnbanMemberDTO,
  SendCrewInviteDTO,
  RespondToCrewInviteDTO,
  GetCrewInviteCandidatesDTO,
  CloseGroupDTO,
  DeleteGroupDTO,
} from "@/lib/dtos";

const GROUP_PATHS = ["/crews"];

function revalidateGroupPaths(): string[] {
  revalidatePath("/crews");
  revalidatePath("/crews", "layout");
  return GROUP_PATHS;
}

export async function createGroup(input: CreateGroupDTO): Promise<CreateGroupResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await createGroupCommand(user.id, input);
  if (!result.error) result.revalidatedPaths = revalidateGroupPaths();
  return result;
}

export async function joinGroupByInvite(input: JoinGroupDTO): Promise<JoinGroupResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await joinGroup(user.id, input, {
    username: user.username,
    avatarUrl: user.avatarUrl,
  });
  if (!result.error) result.revalidatedPaths = revalidateGroupPaths();
  return result;
}

export async function leaveGroup(input: LeaveGroupDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await leaveGroupCommand(user.id, input);
  if (!result.error) result.revalidatedPaths = revalidateGroupPaths();
  return result;
}

export async function setCrewVisibility(input: SetCrewVisibilityDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await setCrewVisibilityCommand(user.id, input);
  if (!result.error) result.revalidatedPaths = revalidateGroupPaths();
  return result;
}

export async function renameGroup(input: RenameGroupDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await renameGroupCommand(user.id, input);
  if (!result.error) result.revalidatedPaths = revalidateGroupPaths();
  return result;
}

export async function regenerateInviteCode(input: RegenerateInviteCodeDTO): Promise<RegenerateInviteCodeResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await regenerateInviteCodeCommand(user.id, input);
  if (!result.error) result.revalidatedPaths = revalidateGroupPaths();
  return result;
}

export async function setMemberRole(input: SetMemberRoleDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await setMemberRoleCommand(user.id, input);
  if (!result.error) result.revalidatedPaths = revalidateGroupPaths();
  return result;
}

export async function kickMember(input: KickMemberDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await kickMemberCommand(user.id, input);
  if (!result.error) result.revalidatedPaths = revalidateGroupPaths();
  return result;
}

export async function unbanMember(input: UnbanMemberDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await unbanMemberCommand(user.id, input);
  if (!result.error) result.revalidatedPaths = revalidateGroupPaths();
  return result;
}

export async function sendCrewInvite(input: SendCrewInviteDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  return sendCrewInviteCommand(user.id, input, {
    username: user.username,
    avatarUrl: user.avatarUrl,
  });
}

export async function respondToCrewInvite(input: RespondToCrewInviteDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

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

/** Who the current user can invite into a crew — null if they can't invite at all right now. */
export async function getCrewInviteCandidates(input: GetCrewInviteCandidatesDTO) {
  const user = await getCurrentUser();
  if (!user) return null;

  return getCrewInviteCandidatesQuery(user.id, input.groupId, {
    search: input.search,
    offset: input.offset,
  });
}

export async function closeGroup(input: CloseGroupDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await closeGroupCommand(user.id, input);
  if (!result.error) result.revalidatedPaths = revalidateGroupPaths();
  return result;
}

export async function deleteGroup(input: DeleteGroupDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await deleteGroupCommand(user.id, input);
  if (!result.error) result.revalidatedPaths = revalidateGroupPaths();
  return result;
}

/** The current user's crews with their rank in each (one bulk read, no N+1). */
export async function getMyCrews(): Promise<CrewSummary[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return getCrewSummariesForUser(user.id);
}

/** A crew's board — null when the crew doesn't exist or the viewer isn't a member. */
export async function getCrew(input: GetCrewDTO): Promise<CrewDetail | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  return getCrewDetailForViewer(input.crewId, user.id);
}
