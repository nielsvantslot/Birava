import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { getCrew } from "@/lib/controllers/groupController";
import { CrewDetailView } from "@/components/drink/crew-detail-view";

export default async function CrewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const [tz, crew] = await Promise.all([
    getUserTimeZone(),
    getCrew({ crewId: id }),
  ]);
  if (!crew) notFound();

  return <CrewDetailView crew={crew} currentUserId={user.id} tz={tz} />;
}
