-- DropForeignKey
ALTER TABLE "public"."DrinkEntry" DROP CONSTRAINT "DrinkEntry_groupId_fkey";

-- DropIndex
DROP INDEX "public"."DrinkEntry_groupId_idx";

-- AlterTable
ALTER TABLE "public"."DrinkEntry" DROP COLUMN "amount",
DROP COLUMN "brewery",
DROP COLUMN "groupId",
DROP COLUMN "rating",
DROP COLUMN "style";

