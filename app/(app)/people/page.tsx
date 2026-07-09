import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { PeopleClient } from "@/components/beer/people-client";


export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Load the IDs the current user already follows
  const follows = await db.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  });

  const followingIds = new Set(follows.map((f) => f.followingId));

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-black">People 🤝</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
          Find and follow friends
        </p>
      </div>
      <PeopleClient followingIds={[...followingIds]} currentUserId={user.id} />
    </div>
  );
}
