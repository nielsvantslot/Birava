-- CreateEnum
CREATE TYPE "public"."JobRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."JobRun" (
    "id" UUID NOT NULL,
    "job" TEXT NOT NULL,
    "status" "public"."JobRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(6),
    "durationMs" INTEGER,
    "rowsProcessed" INTEGER,
    "summary" JSONB,
    "error" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobRun_job_startedAt_idx" ON "public"."JobRun"("job", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "JobRun_startedAt_idx" ON "public"."JobRun"("startedAt");
