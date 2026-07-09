-- Optional GPS coordinates captured when logging a beer
ALTER TABLE "public"."BeerEntry" ADD COLUMN "lat" DECIMAL(9,6);
ALTER TABLE "public"."BeerEntry" ADD COLUMN "lng" DECIMAL(9,6);
