-- Birava 2.0: all-round drinks app — every check-in has a drink type
ALTER TABLE "public"."BeerEntry" ADD COLUMN "drinkType" TEXT NOT NULL DEFAULT 'Beer';
