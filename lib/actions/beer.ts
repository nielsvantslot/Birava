"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { checkAchievements } from "@/lib/achievements";

const BEER_PATHS = ["/dashboard", "/stats", "/history", "/feed"];

function revalidateBeerPaths() {
  for (const path of BEER_PATHS) revalidatePath(path);
  revalidatePath("/leaderboard", "layout");
}

export async function addBeer(payload: {
  beer_name: string | null;
  brewery: string | null;
  style: string | null;
  amount: number;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
}): Promise<{ error?: string; achievementUnlocked?: boolean }> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  // Ensure profile exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const username =
      typeof user.user_metadata?.username === "string" &&
      user.user_metadata.username.trim().length > 0
        ? user.user_metadata.username.trim()
        : `${(user.email?.split("@")[0] ?? "beerlover").replace(/[^a-zA-Z0-9_-]/g, "") || "beerlover"}-${user.id.slice(0, 8)}`;

    const { error: profileInsertError } = await supabase
      .from("profiles")
      .insert({ id: user.id, username });

    if (profileInsertError) return { error: profileInsertError.message };
  }

  const { error } = await supabase.from("beer_entries").insert({
    user_id: user.id,
    ...payload,
  });

  if (error) return { error: error.message };

  // Check achievements
  const { count, error: countError } = await supabase
    .from("beer_entries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  const achievementUnlocked = !countError && checkAchievements(count ?? 0);

  revalidateBeerPaths();

  return { achievementUnlocked: !!achievementUnlocked };
}

export async function editBeer(
  id: string,
  payload: {
    beer_name: string | null;
    brewery: string | null;
    style: string | null;
    amount: number;
    notes: string | null;
    photo_url: string | null;
    created_at: string;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("beer_entries")
    .update({ ...payload })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateBeerPaths();
  return {};
}

export async function deleteBeer(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch photo_url before deleting so we can clean up storage
  const { data: entry } = await supabase
    .from("beer_entries")
    .select("photo_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("beer_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  // Clean up photo from storage if present
  if (entry?.photo_url) {
    const url = new URL(entry.photo_url);
    // Path is like /storage/v1/object/public/beer-photos/{userId}/{filename}
    const prefix = "/storage/v1/object/public/beer-photos/";
    const storagePath = url.pathname.startsWith(prefix)
      ? url.pathname.slice(prefix.length)
      : null;
    if (storagePath) {
      await supabase.storage.from("beer-photos").remove([storagePath]);
    }
  }

  revalidateBeerPaths();
  return {};
}
