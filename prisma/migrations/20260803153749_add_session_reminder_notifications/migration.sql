-- AlterEnum
ALTER TYPE "public"."NotificationType" ADD VALUE 'SESSION_REMINDER';

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "notifySessionReminder" BOOLEAN NOT NULL DEFAULT true;
