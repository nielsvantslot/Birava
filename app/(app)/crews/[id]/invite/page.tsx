import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/identity/server/session";
import { getCrewInviteCandidates } from "@/modules/crews/server/crewReads";
import { CrewInvitePage } from "@/components/drink/crew-invite-page";

export default async function CrewInvitePageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const result = await getCrewInviteCandidates({ groupId: id });
  if (!result) notFound();

  return <CrewInvitePage crewId={id} initial={result} />;
}
