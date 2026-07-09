import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { PeopleClient } from "@/components/beer/people-client";

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const follows = await db.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  });

  const followingIds = new Set(follows.map((f) => f.followingId));

  return (
    <div className="section">
      <div className="h-row" style={{ marginBottom: 6 }}>
        <h3>Find people</h3>
      </div>
      <PeopleClient
        followingIds={[...followingIds]}
        currentUserId={user.id}
      />
    </div>
  );
}
