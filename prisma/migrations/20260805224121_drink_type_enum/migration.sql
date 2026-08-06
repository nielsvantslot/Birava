-- CreateEnum
CREATE TYPE "public"."DrinkType" AS ENUM ('Beer', 'Wine', 'Cocktail', 'Other');

-- AlterTable: cast the existing column in place instead of Prisma's default
-- drop-and-recreate, which would silently reset every row to the new
-- column's default value ('Beer') — real data loss for any check-in that
-- wasn't already Beer. This cast preserves every row's actual value, and
-- fails the whole migration atomically (not silently) if any existing
-- value doesn't exactly match one of the four enum labels.
ALTER TABLE "public"."DrinkEntry"
  ALTER COLUMN "drinkType" DROP DEFAULT,
  ALTER COLUMN "drinkType" TYPE "public"."DrinkType" USING ("drinkType"::"public"."DrinkType"),
  ALTER COLUMN "drinkType" SET DEFAULT 'Beer';
