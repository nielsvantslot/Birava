import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { OnboardingFlow } from "./onboarding-flow";

/** Signup's redirect target — see onboarding-flow.tsx for the actual steps. */
export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <OnboardingFlow username={user.username} />;
}
