-- Backfills DrinkSession for every DrinkEntry that doesn't have one yet
-- (same 4-hour-inactivity-gap rule as lib/sessions.ts's groupIntoSessions /
-- SESSION_GAP_MS — a classic "gaps and islands" query), then enforces
-- sessionId NOT NULL. Both happen automatically, in this one migration —
-- no external script, no manual step, regardless of whether this deploys
-- together with or separately from the migration that added the nullable
-- column: any row still NULL at the moment this runs (whether it predates
-- this whole feature or was created in between the two migrations) gets
-- picked up here.

CREATE TEMP TABLE "_session_backfill" ON COMMIT DROP AS
WITH "ordered" AS (
  SELECT
    "id",
    "userId",
    "createdAt",
    LAG("createdAt") OVER (PARTITION BY "userId" ORDER BY "createdAt", "id") AS "prevCreatedAt"
  FROM "public"."DrinkEntry"
  WHERE "sessionId" IS NULL
),
"flagged" AS (
  SELECT
    "id",
    "userId",
    "createdAt",
    CASE
      WHEN "prevCreatedAt" IS NULL THEN 1
      WHEN "createdAt" - "prevCreatedAt" > INTERVAL '4 hours' THEN 1
      ELSE 0
    END AS "isNewSession"
  FROM "ordered"
),
"grouped" AS (
  SELECT
    "id",
    "userId",
    "createdAt",
    SUM("isNewSession") OVER (
      PARTITION BY "userId" ORDER BY "createdAt", "id"
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS "grp"
  FROM "flagged"
)
SELECT
  "id",
  "userId",
  FIRST_VALUE("id") OVER (PARTITION BY "userId", "grp" ORDER BY "createdAt", "id") AS "anchorId",
  MIN("createdAt") OVER (PARTITION BY "userId", "grp") AS "startedAt",
  MAX("createdAt") OVER (PARTITION BY "userId", "grp") AS "endedAt"
FROM "grouped";

INSERT INTO "public"."DrinkSession" ("id", "userId", "startedAt", "endedAt")
SELECT DISTINCT "anchorId", "userId", "startedAt", "endedAt"
FROM "_session_backfill";

UPDATE "public"."DrinkEntry" "e"
SET "sessionId" = "b"."anchorId"
FROM "_session_backfill" "b"
WHERE "e"."id" = "b"."id";

-- AlterTable
ALTER TABLE "public"."DrinkEntry" ALTER COLUMN "sessionId" SET NOT NULL;
