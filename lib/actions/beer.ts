"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { toBeerEntry } from "@/lib/mappers";
import { earnedIds } from "@/lib/achievements";
import { removeBeerPhotoByUrl } from "@/lib/storage/local";

const CHECKIN_PATHS = ["/dashboard", "/stats", "/log", "/profile", "/achievements"];

function revalidateCheckinPaths() {
  for (const path of CHECKIN_PATHS) revalidatePath(path);
  revalidatePath("/sessions", "layout");
  revalidatePath("/crews", "layout");
}

export type CheckinPayload = {
  drink_name: string | null;
  drink_type: string;
  venue: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  photo_url: string | null;
};

export async function logCheckin(
  payload: CheckinPayload
): Promise<{ error?: string; achievementUnlocked?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const tz = await getUserTimeZone();
  const before = await db.beerEntry.findMany({ where: { userId: user.id } });

  try {
    await db.beerEntry.create({
      data: {
        userId: user.id,
        beerName: payload.drink_name,
        drinkType: payload.drink_type,
        venue: payload.venue,
        lat: payload.lat,
        lng: payload.lng,
        notes: payload.notes,
        photoUrl: payload.photo_url,
      },
    });
  } catch {
    return { error: "Failed to save check-in." };
  }

  const after = await db.beerEntry.findMany({ where: { userId: user.id } });
  const earnedBefore = earnedIds(before.map(toBeerEntry), tz);
  const earnedAfter = earnedIds(after.map(toBeerEntry), tz);
  const achievementUnlocked = [...earnedAfter].some(
    (id) => !earnedBefore.has(id)
  );

  revalidateCheckinPaths();

  return { achievementUnlocked };
}

export async function updateCheckin(
  id: string,
  payload: CheckinPayload
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const existing = await db.beerEntry.findFirst({
    where: { id, userId: user.id },
    select: { photoUrl: true },
  });
  if (!existing) return { error: "Check-in not found" };

  try {
    await db.beerEntry.updateMany({
      where: { id, userId: user.id },
      data: {
        beerName: payload.drink_name,
        drinkType: payload.drink_type,
        venue: payload.venue,
        lat: payload.lat,
        lng: payload.lng,
        notes: payload.notes,
        photoUrl: payload.photo_url,
      },
    });
  } catch {
    return { error: "Failed to update check-in." };
  }

  if (existing.photoUrl && existing.photoUrl !== payload.photo_url) {
    await removeBeerPhotoByUrl(existing.photoUrl);
  }

  revalidateCheckinPaths();
  return {};
}

export async function deleteCheckin(id: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const entry = await db.beerEntry.findFirst({
    where: { id, userId: user.id },
    select: { photoUrl: true },
  });

  try {
    await db.beerEntry.deleteMany({ where: { id, userId: user.id } });
  } catch {
    return { error: "Failed to delete check-in." };
  }

  if (entry?.photoUrl) {
    await removeBeerPhotoByUrl(entry.photoUrl);
  }

  revalidateCheckinPaths();
  return {};
}
