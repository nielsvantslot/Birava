-- Data-preserving rename: Proost -> Cheer, NotificationType.PROOST -> CHEER
ALTER TABLE "Proost" RENAME TO "Cheer";
ALTER TABLE "Cheer" RENAME CONSTRAINT "Proost_pkey" TO "Cheer_pkey";
ALTER TABLE "Cheer" RENAME CONSTRAINT "Proost_entryId_fkey" TO "Cheer_entryId_fkey";
ALTER TABLE "Cheer" RENAME CONSTRAINT "Proost_userId_fkey" TO "Cheer_userId_fkey";

ALTER TYPE "NotificationType" RENAME VALUE 'PROOST' TO 'CHEER';
