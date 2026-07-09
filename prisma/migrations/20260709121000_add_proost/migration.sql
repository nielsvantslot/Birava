-- Birava 2.0: real proost (kudos) on sessions, keyed by the session's
-- anchor check-in (a session's id is its first check-in's id)
CREATE TABLE "public"."Proost" (
    "entryId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proost_pkey" PRIMARY KEY ("entryId","userId")
);

CREATE INDEX "Proost_entryId_idx" ON "public"."Proost"("entryId");

ALTER TABLE "public"."Proost" ADD CONSTRAINT "Proost_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."BeerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Proost" ADD CONSTRAINT "Proost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
