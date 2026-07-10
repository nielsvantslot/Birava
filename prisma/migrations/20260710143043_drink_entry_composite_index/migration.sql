-- DropIndex
DROP INDEX "public"."DrinkEntry_createdAt_idx";

-- DropIndex
DROP INDEX "public"."DrinkEntry_userId_idx";

-- DropIndex
DROP INDEX "public"."Proost_entryId_idx";

-- CreateIndex
CREATE INDEX "DrinkEntry_userId_createdAt_idx" ON "public"."DrinkEntry"("userId", "createdAt");
