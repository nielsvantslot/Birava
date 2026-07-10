"use server";

import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { statsEntrySelect, toStatsEntry } from "@/lib/mappers";
import { earnedIds } from "@/lib/achievements";
import { removeBeerPhotoByUrl } from "@/lib/storage";

const CHECKIN_PATHS = ["/dashboard", "/stats", "/log", "/profile", "/achievements"];

function revalidateAfterCheckin(userId: string) {
  // Server render cache: one tag busts exactly the cached views that contain
  // this user's check-ins — their own history/stats/achievements AND every
  // follower's feed (getFeedEntries tags each included user). updateTag gives
  // read-your-own-writes: the next read waits for fresh data, never stale.
  updateTag(`user:${userId}`);
  // Client router cache: keep the actor's own tabs fresh on the spot, rather
  // than serving the up-to-30s staleTimes copy after they just logged.
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
  // Read history once; the "after" set is provably "before + the new row",
  // so there's no need for a second full-table scan.
  const before = await db.beerEntry.findMany({
    where: { userId: user.id },
    select: statsEntrySelect,
  });

  let created;
  try {
    created = await db.beerEntry.create({
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
      select: statsEntrySelect,
    });
  } catch {
    return { error: "Failed to save check-in." };
  }

  const beforeEntries = before.map(toStatsEntry);
  const earnedBefore = earnedIds(beforeEntries, tz);
  const earnedAfter = earnedIds([...beforeEntries, toStatsEntry(created)], tz);
  const achievementUnlocked = [...earnedAfter].some(
    (id) => !earnedBefore.has(id)
  );

  revalidateAfterCheckin(user.id);

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

  revalidateAfterCheckin(user.id);
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

  revalidateAfterCheckin(user.id);
  return {};
}
