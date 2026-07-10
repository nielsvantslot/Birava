import { Prisma, type DrinkEntry as BeerEntryRow } from "@prisma/client";
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

/**
 * Minimal column set for the history-stats screens (stats, achievements,
 * profile) and the achievement diff on logging. These consumers only read
 * what feeds groupIntoSessions / computeAchievements / activeWeeks — never
 * the Decimal columns (amount/lat/lng), whose per-row deserialization
 * dominates cost on long histories. Keep this in sync with toStatsEntry.
 */
export const statsEntrySelect = {
  id: true,
  userId: true,
  createdAt: true,
  venue: true,
  drinkType: true,
  drinkName: true,
  notes: true,
} satisfies Prisma.DrinkEntrySelect;

type StatsEntryRow = Prisma.DrinkEntryGetPayload<{
  select: typeof statsEntrySelect;
}>;

/**
 * Map a projected row (statsEntrySelect) into a full snake_case BeerEntry.
 * Columns not selected are set to their inert defaults — the stats screens
 * never read them, and this keeps the DTO boundary intact.
 */
export function toStatsEntry(entry: StatsEntryRow): BeerEntry {
  return {
    id: entry.id,
    user_id: entry.userId,
    group_id: null,
    beer_name: entry.drinkName,
    brewery: null,
    style: null,
    drink_type: entry.drinkType,
    amount: 0,
    rating: null,
    venue: entry.venue,
    lat: null,
    lng: null,
    notes: entry.notes,
    photo_url: null,
    created_at: entry.createdAt.toISOString(),
  };
}
