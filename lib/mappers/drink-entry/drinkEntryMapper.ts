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
      drinkType: entry.drinkType,
      amount: Number(entry.amount),
      rating: entry.rating,
      venue: entry.venue,
      lat: entry.lat === null ? null : Number(entry.lat),
      lng: entry.lng === null ? null : Number(entry.lng),
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
