-- AlterTable
ALTER TABLE "public"."DrinkEntry" ADD COLUMN     "sessionId" UUID;

-- CreateTable
CREATE TABLE "public"."DrinkSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "endedAt" TIMESTAMPTZ(6) NOT NULL,
    "name" TEXT,

    CONSTRAINT "DrinkSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrinkSession_userId_endedAt_idx" ON "public"."DrinkSession"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "DrinkEntry_sessionId_idx" ON "public"."DrinkEntry"("sessionId");

-- AddForeignKey
ALTER TABLE "public"."DrinkEntry" ADD CONSTRAINT "DrinkEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."DrinkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DrinkSession" ADD CONSTRAINT "DrinkSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
