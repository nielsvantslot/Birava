import { Prisma } from "@prisma/client";
import { PROXIMITY_THRESHOLD_DEG, venuesMatch } from "@/lib/venueMatching";

type Tx = Prisma.TransactionClient;

/**
 * Finds an existing Venue matching (name, lat, lng) per lib/venueMatching's
 * heuristic, or creates a new one. Used by drinkEntryCommands's
 * addDrink/editDrink — the historical backfill instead lives directly in
 * migration 20260805214224_backfill_venues_from_legacy_columns as SQL, not
 * this function, so live check-ins and that one-time historical pass don't
 * share code (see that migration's comments for why an approximation was
 * acceptable there).
 *
 * Candidates are fetched by name match OR coordinate-proximity match —
 * cheap (both are indexed), cast a deliberately wide net — then narrowed
 * precisely by venuesMatch in application code, since the fallback rules
 * (name-only when coordinates are missing, proximity-only when a name is
 * missing on either side) aren't expressible as a single indexed query.
 * Searching by name alone would miss the case where an earlier nameless
 * check-in (coordinates with no typed venue) already created a Venue at
 * this exact spot — this call should still find and claim that row.
 *
 * Whatever the matched venue was missing — coordinates (created from a
 * name-only visit) or a name (created from a nameless, coordinates-only
 * visit) — gets backfilled onto it here if this call has it. The earlier
 * match was necessarily a best guess with incomplete information; better
 * data narrows it for next time instead of leaving a permanent gap.
 */
export async function resolveVenueId(
  tx: Tx,
  name: string | null,
  lat: number | null,
  lng: number | null
): Promise<string | null> {
  const trimmed = name?.trim() || null;
  if (!trimmed && (lat === null || lng === null)) return null;

  const or: Prisma.VenueWhereInput[] = [];
  if (trimmed) or.push({ name: { equals: trimmed, mode: "insensitive" } });
  if (lat !== null && lng !== null) {
    or.push({
      lat: { gte: lat - PROXIMITY_THRESHOLD_DEG, lte: lat + PROXIMITY_THRESHOLD_DEG },
      lng: { gte: lng - PROXIMITY_THRESHOLD_DEG, lte: lng + PROXIMITY_THRESHOLD_DEG },
    });
  }

  const candidates = await tx.venue.findMany({ where: { OR: or } });

  const match = candidates.find((c) =>
    venuesMatch(
      { name: trimmed, lat, lng },
      { name: c.name, lat: c.lat === null ? null : Number(c.lat), lng: c.lng === null ? null : Number(c.lng) }
    )
  );

  if (match) {
    const updates: { lat?: number; lng?: number; name?: string } = {};
    if (match.lat === null && lat !== null && lng !== null) {
      updates.lat = lat;
      updates.lng = lng;
    }
    if (match.name === null && trimmed) {
      updates.name = trimmed;
    }
    if (Object.keys(updates).length > 0) {
      await tx.venue.update({ where: { id: match.id }, data: updates });
    }
    return match.id;
  }

  const created = await tx.venue.create({
    data: { name: trimmed, lat, lng },
  });
  return created.id;
}
