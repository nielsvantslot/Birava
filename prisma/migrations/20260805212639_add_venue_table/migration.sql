-- AlterTable
ALTER TABLE "public"."DrinkEntry" ADD COLUMN     "venueId" UUID;

-- CreateTable
CREATE TABLE "public"."Venue" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Venue_name_idx" ON "public"."Venue"("name");

-- CreateIndex
CREATE INDEX "DrinkEntry_venueId_idx" ON "public"."DrinkEntry"("venueId");

-- AddForeignKey
ALTER TABLE "public"."DrinkEntry" ADD CONSTRAINT "DrinkEntry_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "public"."Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
