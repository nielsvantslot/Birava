import type { DrinkEntry as DrinkEntryRow, Venue } from "@prisma/client";
import type { DrinkEntryDTO, DrinkEntryWithAuthorDTO, EntryAuthorDTO } from "@/lib/dtos";

type VenueInclude = Pick<Venue, "name" | "lat" | "lng"> | null;

export class DrinkEntryMapper {
  static toDTO(
    entry: DrinkEntryRow & { user?: EntryAuthorDTO | null; venue?: VenueInclude }
  ): DrinkEntryDTO {
    return {
      id: entry.id,
      userId: entry.userId,
      drinkName: entry.drinkName,
      drinkType: entry.drinkType,
      venue: entry.venue?.name ?? null,
      lat: entry.venue?.lat == null ? null : Number(entry.venue.lat),
      lng: entry.venue?.lng == null ? null : Number(entry.venue.lng),
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
      photoUrl: entry.photoUrl,
      photoLqip: entry.photoLqip,
      createdAt: entry.createdAt.toISOString(),
      user: entry.user,
    };
  }
}
