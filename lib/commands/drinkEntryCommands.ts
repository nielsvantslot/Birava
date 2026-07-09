import { db } from "@/lib/db";
import { checkAchievements } from "@/lib/achievements";
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
  try {
    await db.drinkEntry.create({
      data: {
        userId,
        drinkName: input.drinkName,
        brewery: input.brewery,
        style: input.style,
        amount: input.amount,
        notes: input.notes,
        photoUrl: input.photoUrl,
        createdAt: new Date(input.createdAt),
      },
    });
  } catch {
    return { error: "Failed to save drink." };
  }

  const count = await db.drinkEntry.count({ where: { userId } });
  return { achievementUnlocked: !!checkAchievements(count) };
}

export async function updateDrinkEntry(
  userId: string,
  input: UpdateDrinkEntryDTO
): Promise<ActionResultDTO> {
  try {
    await db.drinkEntry.updateMany({
      where: { id: input.id, userId },
      data: {
        drinkName: input.drinkName,
        brewery: input.brewery,
        style: input.style,
        amount: input.amount,
        notes: input.notes,
        photoUrl: input.photoUrl,
        createdAt: new Date(input.createdAt),
      },
    });
  } catch {
    return { error: "Failed to update drink." };
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
    return { error: "Failed to delete drink." };
  }

  if (entry?.photoUrl) {
    await removeDrinkPhotoByUrl(entry.photoUrl);
  }

  return {};
}
