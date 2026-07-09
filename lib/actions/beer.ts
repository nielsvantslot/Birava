"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { checkAchievements } from "@/lib/achievements";
import { removeBeerPhotoByUrl } from "@/lib/storage";

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
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await db.beerEntry.create({
      data: {
        userId: user.id,
        beerName: payload.beer_name,
        brewery: payload.brewery,
        style: payload.style,
        amount: payload.amount,
        notes: payload.notes,
        photoUrl: payload.photo_url,
        createdAt: new Date(payload.created_at),
      },
    });
  } catch {
    return { error: "Failed to save beer." };
  }

  const count = await db.beerEntry.count({ where: { userId: user.id } });
  const achievementUnlocked = checkAchievements(count);

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
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await db.beerEntry.updateMany({
      where: { id, userId: user.id },
      data: {
        beerName: payload.beer_name,
        brewery: payload.brewery,
        style: payload.style,
        amount: payload.amount,
        notes: payload.notes,
        photoUrl: payload.photo_url,
        createdAt: new Date(payload.created_at),
      },
    });
  } catch {
    return { error: "Failed to update beer." };
  }

  revalidateBeerPaths();
  return {};
}

export async function deleteBeer(id: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const entry = await db.beerEntry.findFirst({
    where: { id, userId: user.id },
    select: { photoUrl: true },
  });

  try {
    await db.beerEntry.deleteMany({ where: { id, userId: user.id } });
  } catch {
    return { error: "Failed to delete beer." };
  }

  if (entry?.photoUrl) {
    await removeBeerPhotoByUrl(entry.photoUrl);
  }

  revalidateBeerPaths();
  return {};
}
