import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/identity/server/session";
import { getMyFollowingIds } from "@/modules/social/server/socialReads";
import { OnboardingFlow } from "./onboarding-flow";

/** Signup's redirect target — see onboarding-flow.tsx for the actual steps. */
export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const followingIds = await getMyFollowingIds();

  return <OnboardingFlow userId={user.id} username={user.username} followingIds={followingIds} />;
}
