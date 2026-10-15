"use server";

import { revalidatePath } from "next/cache";
import { gateway } from "@/modules/identity/server/gateway";
import { updateProfileUsername as updateProfileUsernameCommand } from "@/modules/identity/application/userCommands";
import { updateUsernameInput } from "@/modules/identity/contract/accountContract";

// Mutations only: the profile read lives in modules/identity/server/profileReads.ts (a Server Action is a public POST endpoint).

export const updateProfileUsername = gateway.action.authed(
  { name: "identity.update-username", input: updateUsernameInput },
  async ({ user, input }) => {
    const result = await updateProfileUsernameCommand(user.id, input);
    if (!result.error) {
      revalidatePath("/profile");
      revalidatePath(`/profile/${input.username.trim()}`);
    }
    return result;
  }
);
