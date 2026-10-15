"use server";

import { gateway } from "@/modules/identity/server/gateway";
import { completeOnboarding as completeOnboardingCommand } from "@/modules/identity/application/userCommands";

/** Called on both "finish" and "skip" from app/onboarding — either way the flow is done. */
export const completeOnboarding = gateway.action.authed({ name: "identity.complete-onboarding" }, async ({ user }) =>
  completeOnboardingCommand(user.id)
);
