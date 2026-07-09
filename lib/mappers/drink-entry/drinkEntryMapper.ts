import type { DrinkEntry as DrinkEntryRow } from "@prisma/client";
import type { DrinkEntryDTO, DrinkEntryWithAuthorDTO, EntryAuthorDTO } from "@/lib/dtos";

export class DrinkEntryMapper {
  static toDTO(entry: DrinkEntryRow & { user?: EntryAuthorDTO | null }): DrinkEntryDTO {
    return {
      id: entry.id,
      userId: entry.userId,
      groupId: entry.groupId,
      drinkName: entry.drinkName,
      brewery: entry.brewery,
      style: entry.style,
      amount: Number(entry.amount),
      notes: entry.notes,
      photoUrl: entry.photoUrl,
      createdAt: entry.createdAt.toISOString(),
      ...(entry.user ? { user: entry.user } : {}),
    };
  }

  static toDTOWithAuthor(entry: DrinkEntryRow & { user: EntryAuthorDTO }): DrinkEntryWithAuthorDTO {
    return this.toDTO(entry) as DrinkEntryWithAuthorDTO;
  }
}
