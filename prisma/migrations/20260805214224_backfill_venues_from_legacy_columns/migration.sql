-- Data migration: resolves each DrinkEntry's legacy free-text venue/lat/lng
-- into a Venue row and links DrinkEntry.venueId to it. Purely additive to
-- existing data — venue/lat/lng are read, never modified or dropped here
-- (that's a later, separate migration once this is proven out).
--
-- Matching mirrors lib/venueMatching.ts's live-path heuristic as closely as
-- SQL reasonably allows: same name (trimmed, case-insensitive) and, when
-- both sides have coordinates, the same ~111m grid cell (round to 3
-- decimal places) rather than lib/venueMatching.ts's exact pairwise
-- ~100m bounding box — a deliberate, accepted simplification for this
-- one-time historical pass; the live path (lib/commands/venueCommands.ts)
-- keeps doing the more precise pairwise match for everything logged from
-- here on. Unlike the live path, this does not backfill coordinates onto
-- an existing name-only Venue when a later row has real ones, or a name
-- onto an existing coordinate-only Venue — again, acceptable simplifications
-- for a one-time cleanup of historical rows. It DOES still resolve every
-- row that has a name and/or coordinates to a Venue (steps 5-6 handle rows
-- with coordinates but no venue name at all) — skipping that would silently
-- destroy real location data once the next migration drops these columns.

-- Step 1: one Venue per (normalized name, rounded coordinate grid cell)
-- among entries that have coordinates. Canonical display name is
-- whichever spelling was used first, chronologically.
INSERT INTO "public"."Venue" (id, name, lat, lng, "createdAt")
SELECT
  gen_random_uuid(),
  (array_agg(venue ORDER BY "createdAt" ASC))[1],
  round(lat, 3),
  round(lng, 3),
  now()
FROM "public"."DrinkEntry"
WHERE venue IS NOT NULL AND trim(venue) != '' AND lat IS NOT NULL AND lng IS NOT NULL
GROUP BY lower(trim(venue)), round(lat, 3), round(lng, 3);

-- Step 2: link entries that have coordinates to their matching Venue.
UPDATE "public"."DrinkEntry" e
SET "venueId" = v.id
FROM "public"."Venue" v
WHERE e.venue IS NOT NULL AND trim(e.venue) != ''
  AND e.lat IS NOT NULL AND e.lng IS NOT NULL
  AND lower(trim(e.venue)) = lower(trim(v.name))
  AND round(e.lat, 3) = v.lat
  AND round(e.lng, 3) = v.lng
  AND e."venueId" IS NULL;

-- Step 3: entries with NO coordinates fall back to matching an existing
-- Venue by name alone (deterministically, the oldest one created for that
-- name), same fallback-when-location-is-missing idea as the live path.
UPDATE "public"."DrinkEntry" e
SET "venueId" = sub.venue_id
FROM (
  SELECT DISTINCT ON (lower(trim(name))) lower(trim(name)) AS norm_name, id AS venue_id
  FROM "public"."Venue"
  ORDER BY lower(trim(name)), "createdAt" ASC
) sub
WHERE e.venue IS NOT NULL AND trim(e.venue) != ''
  AND (e.lat IS NULL OR e.lng IS NULL)
  AND lower(trim(e.venue)) = sub.norm_name
  AND e."venueId" IS NULL;

-- Step 4: whatever's left over is a venue name that was never logged with
-- coordinates at all — create one coordinate-less Venue per distinct name
-- and link every remaining entry to it.
INSERT INTO "public"."Venue" (id, name, lat, lng, "createdAt")
SELECT gen_random_uuid(), (array_agg(venue ORDER BY "createdAt" ASC))[1], NULL, NULL, now()
FROM "public"."DrinkEntry"
WHERE venue IS NOT NULL AND trim(venue) != '' AND "venueId" IS NULL
GROUP BY lower(trim(venue));

UPDATE "public"."DrinkEntry" e
SET "venueId" = v.id
FROM "public"."Venue" v
WHERE e.venue IS NOT NULL AND trim(e.venue) != ''
  AND e."venueId" IS NULL
  AND lower(trim(e.venue)) = lower(trim(v.name));

-- Step 5: entries with NO venue name but WITH coordinates (geolocation is
-- captured independently of the venue text field — see
-- components/drink/log-drink-form.tsx — so this is a real, reachable
-- shape, not a hypothetical) first try to attach to any existing Venue —
-- named or not — at the same rounded coordinate grid cell, mirroring the
-- live path's "claim a nameless-or-named venue by proximity" behavior.
-- Missing this case would silently destroy real location data once
-- venue/lat/lng are dropped by the next migration — caught via a full
-- migration rehearsal against synthetic legacy data before this ever
-- reached anything real (see docs/architecture.md's "Venue extraction").
UPDATE "public"."DrinkEntry" e
SET "venueId" = v.id
FROM "public"."Venue" v
WHERE e.venue IS NULL
  AND e.lat IS NOT NULL AND e.lng IS NOT NULL
  AND e."venueId" IS NULL
  AND v.lat IS NOT NULL AND v.lng IS NOT NULL
  AND round(e.lat, 3) = v.lat
  AND round(e.lng, 3) = v.lng;

-- Step 6: whatever's still unresolved and has coordinates gets a new
-- nameless Venue per distinct rounded coordinate grid cell.
INSERT INTO "public"."Venue" (id, name, lat, lng, "createdAt")
SELECT gen_random_uuid(), NULL, round(lat, 3), round(lng, 3), now()
FROM "public"."DrinkEntry"
WHERE venue IS NULL AND lat IS NOT NULL AND lng IS NOT NULL AND "venueId" IS NULL
GROUP BY round(lat, 3), round(lng, 3);

UPDATE "public"."DrinkEntry" e
SET "venueId" = v.id
FROM "public"."Venue" v
WHERE e.venue IS NULL
  AND e.lat IS NOT NULL AND e.lng IS NOT NULL
  AND e."venueId" IS NULL
  AND v.name IS NULL
  AND round(e.lat, 3) = v.lat
  AND round(e.lng, 3) = v.lng;
