import { createClient } from "@/lib/supabase/server";
import { PeopleClient } from "@/components/beer/people-client";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Load the IDs the current user already follows
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);

  const followingIds = new Set((follows ?? []).map((f) => f.following_id));

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
