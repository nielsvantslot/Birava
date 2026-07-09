-- Add optional rating (1-5 stars) and venue to beer entries
ALTER TABLE "public"."BeerEntry" ADD COLUMN "rating" INTEGER;
ALTER TABLE "public"."BeerEntry" ADD COLUMN "venue" TEXT;
