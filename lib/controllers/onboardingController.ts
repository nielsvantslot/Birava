"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { NOT_AUTHENTICATED } from "@/lib/auth/authErrors";
import { completeOnboarding as completeOnboardingCommand } from "@/lib/commands/userCommands";
import { ActionResultDTO } from "@/lib/dtos";

/** Called on both "finish" and "skip" from app/onboarding — either way the flow is done. */
export async function completeOnboarding(): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  return completeOnboardingCommand(user.id);
}
