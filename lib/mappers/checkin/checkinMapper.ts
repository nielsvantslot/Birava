import type { DrinkEntry as DrinkEntryRow } from "@prisma/client";
import type { DrinkEntry } from "@/lib/types";

type ProfileInclude = { username: string; avatarUrl: string | null } | null;

export function toDrinkEntry(
  entry: DrinkEntryRow & { user?: ProfileInclude }
): DrinkEntry {
  return {
    id: entry.id,
    user_id: entry.userId,
    drink_name: entry.drinkName,
    drink_type: entry.drinkType,
    venue: entry.venue,
    lat: entry.lat === null ? null : Number(entry.lat),
    lng: entry.lng === null ? null : Number(entry.lng),
    notes: entry.notes,
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
