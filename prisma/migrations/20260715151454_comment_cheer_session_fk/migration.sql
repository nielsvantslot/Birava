-- Data-preserving: Cheer/Comment.entryId -> sessionId, re-pointed at
-- DrinkSession instead of DrinkEntry. Not a plain rename: entryId values
-- were the session's anchor check-in id by convention only, and Phase 2's
-- write paths can merge two sessions (deleting the losing DrinkSession row
-- while its anchor DrinkEntry row survives, reassigned to the survivor's
-- sessionId). So sessionId must be resolved via a join through
-- DrinkEntry.sessionId, not copied from entryId directly, or a comment/cheer
-- made before a merge would end up pointing at a session that no longer
-- exists.

-- Cheer -------------------------------------------------------------------

ALTER TABLE "public"."Cheer" ADD COLUMN "sessionId" UUID;

UPDATE "public"."Cheer" c
SET "sessionId" = e."sessionId"
FROM "public"."DrinkEntry" e
WHERE e."id" = c."entryId";

-- A merge can make two previously-distinct cheers (same user, two sessions
-- that later became one) collide on the new (sessionId, userId) pair.
-- Keep one arbitrarily — the cheer itself is boolean, there's nothing to
-- reconcile beyond not double-counting it.
DELETE FROM "public"."Cheer" a USING "public"."Cheer" b
WHERE a.ctid < b.ctid
  AND a."sessionId" = b."sessionId"
  AND a."userId" = b."userId";

ALTER TABLE "public"."Cheer" ALTER COLUMN "sessionId" SET NOT NULL;
ALTER TABLE "public"."Cheer" DROP CONSTRAINT "Cheer_entryId_fkey";
ALTER TABLE "public"."Cheer" DROP CONSTRAINT "Cheer_pkey";
ALTER TABLE "public"."Cheer" DROP COLUMN "entryId";
ALTER TABLE "public"."Cheer" ADD CONSTRAINT "Cheer_pkey" PRIMARY KEY ("sessionId", "userId");
ALTER TABLE "public"."Cheer" ADD CONSTRAINT "Cheer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."DrinkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comment -------------------------------------------------------------------
-- No composite uniqueness here, so no dedupe needed — multiple comments per
-- (session, user) were always allowed.

ALTER TABLE "public"."Comment" ADD COLUMN "sessionId" UUID;

UPDATE "public"."Comment" c
SET "sessionId" = e."sessionId"
FROM "public"."DrinkEntry" e
WHERE e."id" = c."entryId";

ALTER TABLE "public"."Comment" ALTER COLUMN "sessionId" SET NOT NULL;
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_entryId_fkey";
DROP INDEX "public"."Comment_entryId_createdAt_idx";
ALTER TABLE "public"."Comment" DROP COLUMN "entryId";
CREATE INDEX "Comment_sessionId_createdAt_idx" ON "public"."Comment"("sessionId", "createdAt");
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."DrinkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
