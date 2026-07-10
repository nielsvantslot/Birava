"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { NOT_AUTHENTICATED } from "@/lib/auth/authErrors";
import {
  createGroup as createGroupCommand,
  joinGroup,
  leaveGroup as leaveGroupCommand,
  deleteGroup,
} from "@/lib/commands/groupCommands";
import {
  getCrewSummariesForUser,
  getCrewDetailForViewer,
  type CrewSummary,
  type CrewDetail,
} from "@/lib/queries/groupQueries";
import {
  ActionResultDTO,
  CreateGroupDTO,
  CreateGroupResultDTO,
  DeleteGroupDTO,
  GetCrewDTO,
  JoinGroupDTO,
  JoinGroupResultDTO,
  LeaveGroupDTO,
} from "@/lib/dtos";

function revalidateGroupPaths() {
  revalidatePath("/crews");
  revalidatePath("/crews", "layout");
}

export async function createGroup(input: CreateGroupDTO): Promise<CreateGroupResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await createGroupCommand(user.id, input);
  if (!result.error) revalidateGroupPaths();
  return result;
}

export async function joinGroupByInvite(input: JoinGroupDTO): Promise<JoinGroupResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await joinGroup(user.id, input);
  if (!result.error) revalidateGroupPaths();
  return result;
}

export async function leaveGroup(input: LeaveGroupDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await leaveGroupCommand(user.id, input);
  if (!result.error) revalidateGroupPaths();
  return result;
}

export async function deleteOwnedGroup(input: DeleteGroupDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await deleteGroup(user.id, input);
  if (!result.error) revalidateGroupPaths();
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
