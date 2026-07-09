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
  ActionResultDTO,
  CreateGroupDTO,
  DeleteGroupDTO,
  JoinGroupDTO,
  LeaveGroupDTO,
} from "@/lib/dtos";

function revalidateGroupPaths() {
  revalidatePath("/leaderboard");
  revalidatePath("/leaderboard", "layout");
}

export async function createGroup(input: CreateGroupDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await createGroupCommand(user.id, input);
  if (!result.error) revalidateGroupPaths();
  return result;
}

export async function joinGroupByInvite(input: JoinGroupDTO): Promise<ActionResultDTO> {
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
