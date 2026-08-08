-- AlterTable
ALTER TABLE "public"."Notification" ADD COLUMN     "openedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notification_type_entryId_idx" ON "public"."Notification"("type", "entryId");
