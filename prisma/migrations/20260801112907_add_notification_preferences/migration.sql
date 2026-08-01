-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "notifyAchievement" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyCheer" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyCrewActivity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyCrewCheckin" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyFollowing" BOOLEAN NOT NULL DEFAULT true;
