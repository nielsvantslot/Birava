"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { NOT_AUTHENTICATED } from "@/lib/auth/authErrors";
import { updateProfileUsername as updateProfileUsernameCommand } from "@/lib/commands/userCommands";
import { getProfileByUsername as getProfileByUsernameQuery } from "@/lib/queries/userQueries";
import { ActionResultDTO, GetProfileByUsernameDTO, ProfileDTO, UpdateProfileDTO } from "@/lib/dtos";

export async function updateProfileUsername(input: UpdateProfileDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await updateProfileUsernameCommand(user.id, input);
  if (!result.error) {
    revalidatePath("/profile");
    revalidatePath(`/profile/${input.username.trim()}`);
  }
  return result;
}

export async function getProfileByUsername(
  input: GetProfileByUsernameDTO
): Promise<ProfileDTO | null> {
  return getProfileByUsernameQuery(input.username);
}
