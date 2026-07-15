/*
  Warnings:

  - Made the column `sessionId` on table `DrinkEntry` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."DrinkEntry" ALTER COLUMN "sessionId" SET NOT NULL;
