import type { DrinkEntry as DrinkEntryRow } from "@prisma/client";
import type { DrinkEntryDTO, DrinkEntryWithAuthorDTO, EntryAuthorDTO } from "@/lib/dtos";

export class DrinkEntryMapper {
  static toDTO(entry: DrinkEntryRow & { user?: EntryAuthorDTO | null }): DrinkEntryDTO {
    return {
      id: entry.id,
      userId: entry.userId,
      drinkName: entry.drinkName,
      drinkType: entry.drinkType,
      venue: entry.venue,
      lat: entry.lat === null ? null : Number(entry.lat),
      lng: entry.lng === null ? null : Number(entry.lng),
      notes: entry.notes,
      photoUrl: entry.photoUrl,
      photoLqip: entry.photoLqip,
      createdAt: entry.createdAt.toISOString(),
      ...(entry.user ? { user: entry.user } : {}),
    };
  }

  static toDTOWithAuthor(entry: DrinkEntryRow & { user: EntryAuthorDTO }): DrinkEntryWithAuthorDTO {
    // Not delegating to toDTO(): its `user` field is optional (DrinkEntryDTO
    // treats an author as sometimes-absent), while this DTO requires it —
    // building the literal directly lets the compiler prove that instead of
    // casting past the mismatch.
    return {
      id: entry.id,
      userId: entry.userId,
      drinkName: entry.drinkName,
      notes: entry.notes,
      photoUrl: entry.photoUrl,
      photoLqip: entry.photoLqip,
      createdAt: entry.createdAt.toISOString(),
      user: entry.user,
    };
  }
}
