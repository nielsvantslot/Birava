import { getCurrentUser } from "@/lib/auth/session";
import { getFollowingList, getMyFollowingIds } from "@/lib/controllers/socialController";
import { UserList } from "@/components/drink/user-list";

export default async function MyFollowingPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [following, followingIds] = await Promise.all([
    getFollowingList({ profileId: user.id }),
    getMyFollowingIds(),
  ]);

  return (
    <div className="section">
      <UserList
        users={following}
        currentUserId={user.id}
        followingIds={new Set(followingIds)}
        emptyMessage="Not following anyone yet."
      />
    </div>
  );
}
