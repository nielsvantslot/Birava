import { redirect } from "next/navigation";

export default async function LegacyGroupLeaderboardPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  redirect(`/crews/${groupId}`);
}
