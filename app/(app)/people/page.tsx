import { getCurrentUser } from "@/lib/auth/session";
import { getMyFollowingIds } from "@/lib/controllers/socialController";
import { PeopleClient } from "@/components/drink/people-client";

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const followingIds = await getMyFollowingIds();

  return (
    <div className="section">
      <div className="h-row" style={{ marginBottom: 6 }}>
        <h3>Find people</h3>
      </div>
      <PeopleClient followingIds={followingIds} currentUserId={user.id} />
    </div>
  );
}
