"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, clearUserSession } from "@/lib/auth/session";
import { NOT_AUTHENTICATED } from "@/lib/auth/authErrors";
import { requestAccountDeletion as requestAccountDeletionCommand } from "@/lib/commands/userCommands";
import { ActionResultDTO } from "@/lib/dtos";

/**
 * Starts the GDPR-erasure grace period for the current user (see
 * lib/commands/userCommands.ts's requestAccountDeletion for the full flow).
 * Also clears this browser's own session cookie immediately — the command
 * already deletes every Session row, but that alone doesn't touch the
 * cookie, so without this the current tab would still look logged in until
 * its next auth check.
 */
export async function requestAccountDeletion(): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await requestAccountDeletionCommand(user.id);
  if (!result.error) {
    await clearUserSession();
    // Revalidate crew pages in case ownership transferred — other members
    // should see the new owner on their next load, not a stale cached one.
    revalidatePath("/crews");
    revalidatePath("/crews", "layout");
  }
  return result;
}
