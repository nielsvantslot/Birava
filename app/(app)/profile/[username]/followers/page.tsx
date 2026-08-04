import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfileByUsername } from "@/lib/controllers/profileController";
import { getFollowersList, getMyFollowingIds } from "@/lib/controllers/socialController";
import { UserList } from "@/components/drink/user-list";

interface Props {
  params: Promise<{ username: string }>;
}

export default async function UserFollowersPage({ params }: Props) {
  const { username } = await params;
  const [currentUser, targetUser] = await Promise.all([
    getCurrentUser(),
    getProfileByUsername({ username }),
  ]);
  if (!targetUser) notFound();
  if (!currentUser) return null;

  const [followers, followingIds] = await Promise.all([
    getFollowersList({ profileId: targetUser.id }),
    getMyFollowingIds(),
  ]);

  return (
    <div className="section">
      <UserList
        users={followers}
        currentUserId={currentUser.id}
        followingIds={new Set(followingIds)}
        emptyMessage="No followers yet."
      />
    </div>
  );
}
