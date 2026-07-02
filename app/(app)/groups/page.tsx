import { createClient } from "@/lib/supabase/server";
import { GroupsClient } from "@/components/beer/groups-client";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("group_members")
    .select("groups(id, name, invite_code, owner_id)")
    .eq("user_id", user.id);

  const groups =
    memberships?.flatMap((m) =>
      Array.isArray(m.groups) ? m.groups : m.groups ? [m.groups] : []
    ) ?? [];

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-black">Groups 👥</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
          Track beers together
        </p>
      </div>

      {groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="text-6xl mb-4">👥</span>
          <p className="font-semibold text-lg">No groups yet</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Create a group or join one with an invite code.
          </p>
        </div>
      )}

      <GroupsClient groups={groups} userId={user.id} />
    </div>
  );
}
