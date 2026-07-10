-- RenameTable
ALTER TABLE "public"."BeerEntry" RENAME TO "DrinkEntry";

-- RenameColumn
ALTER TABLE "public"."DrinkEntry" RENAME COLUMN "beerName" TO "drinkName";

-- RenameConstraint
ALTER TABLE "public"."DrinkEntry" RENAME CONSTRAINT "BeerEntry_pkey" TO "DrinkEntry_pkey";
ALTER TABLE "public"."DrinkEntry" RENAME CONSTRAINT "BeerEntry_userId_fkey" TO "DrinkEntry_userId_fkey";
ALTER TABLE "public"."DrinkEntry" RENAME CONSTRAINT "BeerEntry_groupId_fkey" TO "DrinkEntry_groupId_fkey";

-- RenameIndex
ALTER INDEX "public"."BeerEntry_userId_idx" RENAME TO "DrinkEntry_userId_idx";
ALTER INDEX "public"."BeerEntry_groupId_idx" RENAME TO "DrinkEntry_groupId_idx";
ALTER INDEX "public"."BeerEntry_createdAt_idx" RENAME TO "DrinkEntry_createdAt_idx";
