"use server";

import { revalidatePath } from "next/cache";
import { gateway } from "@/modules/identity/server/gateway";
import { clearUserSession } from "@/modules/identity/server/session";
import { requestAccountDeletion as requestAccountDeletionCommand } from "@/modules/identity/application/userCommands";

/**
 * Starts the GDPR-erasure grace period for the current user (see
 * modules/identity/application/userCommands.ts's requestAccountDeletion for the full flow).
 * Also clears this browser's own session cookie immediately — the command
 * already deletes every Session row, but that alone doesn't touch the
 * cookie, so without this the current tab would still look logged in until
 * its next auth check.
 */
export const requestAccountDeletion = gateway.action.authed({ name: "identity.request-account-deletion" }, async ({ user }) => {
  const result = await requestAccountDeletionCommand(user.id);
  if (!result.error) {
    await clearUserSession();
    // Revalidate crew pages in case ownership transferred — other members
    // should see the new owner on their next load, not a stale cached one.
    revalidatePath("/crews");
    revalidatePath("/crews", "layout");
  }
  return result;
});
