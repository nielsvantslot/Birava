import type { BeerEntry as BeerEntryRow } from "@prisma/client";
import type { BeerEntry, FeedEntry } from "@/lib/types";

type ProfileInclude = { username: string; avatarUrl: string | null } | null;

export function toBeerEntry(
  entry: BeerEntryRow & { user?: ProfileInclude }
): BeerEntry {
  return {
    id: entry.id,
    user_id: entry.userId,
    group_id: entry.groupId,
    beer_name: entry.beerName,
    brewery: entry.brewery,
    style: entry.style,
    amount: Number(entry.amount),
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

export function toFeedEntry(
  entry: BeerEntryRow & { user: { username: string; avatarUrl: string | null } }
): FeedEntry {
  return {
    id: entry.id,
    user_id: entry.userId,
    group_id: entry.groupId,
    beer_name: entry.beerName,
    brewery: entry.brewery,
    style: entry.style,
    amount: Number(entry.amount),
    notes: entry.notes,
    photo_url: entry.photoUrl,
    created_at: entry.createdAt.toISOString(),
    username: entry.user.username,
    avatar_url: entry.user.avatarUrl,
  };
}
