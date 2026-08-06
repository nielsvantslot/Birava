/*
  Warnings:

  - You are about to drop the column `lat` on the `DrinkEntry` table. All the data in the column will be lost.
  - You are about to drop the column `lng` on the `DrinkEntry` table. All the data in the column will be lost.
  - You are about to drop the column `venue` on the `DrinkEntry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."DrinkEntry" DROP COLUMN "lat",
DROP COLUMN "lng",
DROP COLUMN "venue";
