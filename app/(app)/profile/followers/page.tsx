import { getCurrentUser } from "@/lib/auth/session";
import { getFollowersList, getMyFollowingIds } from "@/lib/controllers/socialController";
import { UserList } from "@/components/drink/user-list";

export default async function MyFollowersPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [followers, followingIds] = await Promise.all([
    getFollowersList({ profileId: user.id }),
    getMyFollowingIds(),
  ]);

  return (
    <div className="section">
      <UserList
        users={followers}
        currentUserId={user.id}
        followingIds={new Set(followingIds)}
        emptyMessage="No followers yet."
      />
    </div>
  );
}
