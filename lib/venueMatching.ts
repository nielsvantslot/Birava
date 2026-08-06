/**
 * Same real place, or not — a heuristic, not an exact match. Backing the
 * Venue extraction (see prisma/schema.prisma's Venue model): a typed venue
 * name and/or captured coordinates get resolved against existing Venue
 * rows using this, rather than ever creating a duplicate for the same
 * place logged with slightly different capitalization/whitespace, or
 * logged with a name one time and bare coordinates another.
 *
 * A Venue's name is nullable — a check-in can carry coordinates with no
 * venue name typed at all (log-drink-form.tsx captures geolocation
 * independently of the venue text field), so "no name" has to be a real,
 * matchable state, not just a fallback.
 */

// A simple lat/lng bounding box, not true geodesic (Haversine) distance —
// deliberately: at city scale the difference is negligible, and this stays
// index-friendly and trivial to reason about. ~0.001 degrees is roughly
// 100m at these latitudes; good enough to say "same building or block."
export const PROXIMITY_THRESHOLD_DEG = 0.001;

export type VenueCandidate = {
  name: string | null;
  lat: number | null;
  lng: number | null;
};

export function normalizeVenueName(name: string): string {
  return name.trim().toLowerCase();
}

function withinProximity(a: VenueCandidate, b: VenueCandidate): boolean {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) return false;
  return (
    Math.abs(a.lat - b.lat) <= PROXIMITY_THRESHOLD_DEG &&
    Math.abs(a.lng - b.lng) <= PROXIMITY_THRESHOLD_DEG
  );
}

/**
 * Whether `a` and `b` plausibly describe the same physical venue:
 *
 * - Both have a name: the names must agree (normalized) — two differently
 *   named places never merge, no matter how close together they are.
 *   Once names agree (or either side has no name to compare), coordinates
 *   decide it: within the proximity threshold if both have coordinates,
 *   or accepted as a name-only fallback match if either side lacks
 *   coordinates (the same-name case only — see below).
 * - Either side has no name: there's nothing to compare names on, so the
 *   only remaining signal is location — matches only if both sides have
 *   coordinates and they're within the proximity threshold. (A query with
 *   neither a name nor coordinates never reaches this function at all —
 *   see resolveVenueId — so this never needs a "nothing to compare at all"
 *   case.)
 */
export function venuesMatch(a: VenueCandidate, b: VenueCandidate): boolean {
  const aName = a.name ? normalizeVenueName(a.name) : null;
  const bName = b.name ? normalizeVenueName(b.name) : null;

  if (aName !== null && bName !== null) {
    if (aName !== bName) return false;
    // Same name from here — a missing coordinate on either side is still
    // an acceptable match (the original name-only fallback).
    if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) return true;
    return withinProximity(a, b);
  }

  // At least one side has no name — location is the only shared signal.
  return withinProximity(a, b);
}
