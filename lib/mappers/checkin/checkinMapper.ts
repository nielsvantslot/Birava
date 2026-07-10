import type { DrinkEntry as BeerEntryRow } from "@prisma/client";
import type { BeerEntry } from "@/lib/types";

type ProfileInclude = { username: string; avatarUrl: string | null } | null;

export function toBeerEntry(
  entry: BeerEntryRow & { user?: ProfileInclude }
): BeerEntry {
  return {
    id: entry.id,
    user_id: entry.userId,
    group_id: entry.groupId,
    beer_name: entry.drinkName,
    brewery: entry.brewery,
    style: entry.style,
    drink_type: entry.drinkType,
    amount: Number(entry.amount),
    rating: entry.rating,
    venue: entry.venue,
    lat: entry.lat === null ? null : Number(entry.lat),
    lng: entry.lng === null ? null : Number(entry.lng),
    notes: entry.notes,
    photo_url: entry.photoUrl,
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
