import type { DrinkEntry as DrinkEntryRow, Venue } from "@prisma/client";
import type { DrinkEntry } from "@/lib/types";
import { VenueGeoMapper } from "@/lib/mappers/venue/venueGeo";

type ProfileInclude = { username: string; avatarUrl: string | null } | null;
type VenueInclude = Pick<Venue, "name" | "lat" | "lng"> | null;

export function toDrinkEntry(
  entry: DrinkEntryRow & { user?: ProfileInclude; venue?: VenueInclude }
): DrinkEntry {
  return {
    id: entry.id,
    user_id: entry.userId,
    session_id: entry.sessionId,
    drink_name: entry.drinkName,
    drink_type: entry.drinkType,
    venue: entry.venue?.name ?? null,
    ...VenueGeoMapper.toLatLng(entry.venue?.lat ?? null, entry.venue?.lng ?? null),
    photo_url: entry.photoUrl,
    photo_lqip: entry.photoLqip,
    created_at: entry.createdAt.toISOString(),
    ...(entry.user
      ? {
          profiles: {
            id: entry.userId,
            username: entry.user.username,
            avatar_url: entry.user.avatarUrl,
            created_at: entry.createdAt.toISOString(),
          },
        }
      : {}),
  };
}
