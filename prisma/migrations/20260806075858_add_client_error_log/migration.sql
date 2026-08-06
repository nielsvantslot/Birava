-- CreateTable
CREATE TABLE "public"."ClientErrorLog" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "pageUrl" TEXT,
    "userAgent" TEXT,
    "userId" UUID,
    "context" JSONB,

    CONSTRAINT "ClientErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientErrorLog_createdAt_idx" ON "public"."ClientErrorLog"("createdAt");

-- CreateIndex
CREATE INDEX "ClientErrorLog_userId_idx" ON "public"."ClientErrorLog"("userId");

-- AddForeignKey
ALTER TABLE "public"."ClientErrorLog" ADD CONSTRAINT "ClientErrorLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
