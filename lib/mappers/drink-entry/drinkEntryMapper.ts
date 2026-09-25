import type { DrinkEntry as DrinkEntryRow, Venue } from "@prisma/client";
import type { DrinkEntryDTO, EntryAuthorDTO } from "@/lib/dtos";
import { VenueGeoMapper } from "@/lib/mappers/venue/venueGeo";

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
      ...VenueGeoMapper.toLatLng(entry.venue?.lat ?? null, entry.venue?.lng ?? null),
      photoUrl: entry.photoUrl,
      photoLqip: entry.photoLqip,
      createdAt: entry.createdAt.toISOString(),
      ...(entry.user ? { user: entry.user } : {}),
    };
  }
}
