import { db } from "@/lib/db";
import { PostgresIdempotencyStore } from "@/lib/gateway/PostgresIdempotencyStore";
import { LoggerFactory } from "@/lib/logging/LoggerFactory";
import { JobRunner } from "@/modules/jobs/application/JobRunner";
import { CleanupOrphanedBlobsJob } from "@/modules/jobs/application/jobs/CleanupOrphanedBlobsJob";
import { PruneStaleRowsJob } from "@/modules/jobs/application/jobs/PruneStaleRowsJob";
import { PurgeDeletedAccountsJob } from "@/modules/jobs/application/jobs/PurgeDeletedAccountsJob";
import { SessionRemindersJob } from "@/modules/jobs/application/jobs/SessionRemindersJob";
import type { IJob } from "@/modules/jobs/domain/JobDefinition";
import { PrismaJobRunRepository } from "@/modules/jobs/infrastructure/PrismaJobRunRepository";

/** Composition root for scheduled work: every job, the runner that records them, and the repository behind both. */
const runs = new PrismaJobRunRepository(db);

export const jobRunner = new JobRunner(runs, LoggerFactory.create("cron"));

export const jobRunRepository = runs;

export const jobs = {
  sessionReminders: new SessionRemindersJob(),
  cleanupOrphanedBlobs: new CleanupOrphanedBlobsJob(),
  purgeDeletedAccounts: new PurgeDeletedAccountsJob(),
  pruneStaleRows: new PruneStaleRowsJob(new PostgresIdempotencyStore(db), runs),
} as const;

/** Every job, for anything that needs to enumerate them (the health check). */
export const allJobs: readonly IJob[] = Object.values(jobs);
