import type { DrinkEntry as DrinkEntryRow, Venue } from "@prisma/client";
import type { DrinkEntryDTO, EntryAuthorDTO } from "@/lib/dtos";

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
}
