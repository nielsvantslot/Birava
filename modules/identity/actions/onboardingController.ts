"use server";

import { getCurrentUser } from "@/modules/identity/server/session";
import { NOT_AUTHENTICATED } from "@/modules/identity/server/authErrors";
import { completeOnboarding as completeOnboardingCommand } from "@/modules/identity/application/userCommands";
import { ActionResultDTO } from "@/lib/dtos";

/** Called on both "finish" and "skip" from app/onboarding — either way the flow is done. */
export async function completeOnboarding(): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  return completeOnboardingCommand(user.id);
}
