import { db } from "@/lib/db";
import { earnedIds } from "@/lib/achievements";
import { getUserTimeZone } from "@/lib/timezone";
import { toBeerEntry } from "@/lib/mappers";
import { removeDrinkPhotoByUrl } from "@/lib/storage";
import {
  ActionResultDTO,
  AddDrinkResultDTO,
  CreateDrinkEntryDTO,
  DeleteDrinkEntryDTO,
  UpdateDrinkEntryDTO,
} from "@/lib/dtos";

export async function createDrinkEntry(
  userId: string,
  input: CreateDrinkEntryDTO
): Promise<AddDrinkResultDTO> {
  const tz = await getUserTimeZone();
  // Read history once; the "after" set is provably "before + the new row",
  // so there's no need for a second full-table scan.
  const before = await db.drinkEntry.findMany({ where: { userId } });

  let created;
  try {
    created = await db.drinkEntry.create({
      data: {
        userId,
        drinkName: input.drinkName,
        drinkType: input.drinkType,
        venue: input.venue,
        lat: input.lat,
        lng: input.lng,
        notes: input.notes,
        photoUrl: input.photoUrl,
      },
    });
  } catch {
    return { error: "Failed to save check-in." };
  }

  const beforeEntries = before.map(toBeerEntry);
  const earnedBefore = earnedIds(beforeEntries, tz);
  const earnedAfter = earnedIds([...beforeEntries, toBeerEntry(created)], tz);
  const achievementUnlocked = [...earnedAfter].some((id) => !earnedBefore.has(id));

  return { achievementUnlocked };
}

export async function updateDrinkEntry(
  userId: string,
  input: UpdateDrinkEntryDTO
): Promise<ActionResultDTO> {
  const existing = await db.drinkEntry.findFirst({
    where: { id: input.id, userId },
    select: { photoUrl: true },
  });
  if (!existing) return { error: "Check-in not found" };

  try {
    await db.drinkEntry.updateMany({
      where: { id: input.id, userId },
      data: {
        drinkName: input.drinkName,
        drinkType: input.drinkType,
        venue: input.venue,
        lat: input.lat,
        lng: input.lng,
        notes: input.notes,
        photoUrl: input.photoUrl,
      },
    });
  } catch {
    return { error: "Failed to update check-in." };
  }

  if (existing.photoUrl && existing.photoUrl !== input.photoUrl) {
    await removeDrinkPhotoByUrl(existing.photoUrl);
  }

  return {};
}

export async function deleteDrinkEntry(
  userId: string,
  input: DeleteDrinkEntryDTO
): Promise<ActionResultDTO> {
  const entry = await db.drinkEntry.findFirst({
    where: { id: input.id, userId },
    select: { photoUrl: true },
  });

  try {
    await db.drinkEntry.deleteMany({ where: { id: input.id, userId } });
  } catch {
    return { error: "Failed to delete check-in." };
  }

  if (entry?.photoUrl) {
    await removeDrinkPhotoByUrl(entry.photoUrl);
  }

  return {};
}
