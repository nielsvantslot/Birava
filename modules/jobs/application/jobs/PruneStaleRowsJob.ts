import type { PostgresIdempotencyStore } from "@/lib/gateway/PostgresIdempotencyStore";
import { RateLimitBucketPruner } from "@/lib/rateLimit/RateLimitBucketPruner";
import { pruneClientErrorLogs } from "@/modules/diagnostics";
import { DAY_MS, type IJob, type JobResult } from "@/modules/jobs/domain/JobDefinition";
import type { IJobRunRepository } from "@/modules/jobs/domain/IJobRunRepository";

const JOB_RUN_RETENTION_MS = 30 * DAY_MS;

/**
 * Keeps small bookkeeping tables bounded: client error logs, rate-limit
 * buckets, idempotency records and the job-run history itself. Scheduled
 * daily, under the name prune-client-error-logs that its workflow already
 * uses (one cron for several unrelated small tables).
 */
export class PruneStaleRowsJob implements IJob {
  readonly name = "prune-client-error-logs" as const;
  readonly expectedEveryMs = DAY_MS;
  readonly workBudget = "deletes everything past each table's retention in a few set-based statements";

  constructor(
    private readonly idempotency: Pick<PostgresIdempotencyStore, "pruneExpired">,
    private readonly runs: Pick<IJobRunRepository, "prune">
  ) {}

  async run(): Promise<JobResult> {
    const [clientErrorLogs, rateLimitBuckets, idempotencyKeys, jobRuns] = await Promise.all([
      pruneClientErrorLogs(),
      RateLimitBucketPruner.prune(),
      this.idempotency.pruneExpired(),
      this.runs.prune(new Date(Date.now() - JOB_RUN_RETENTION_MS)),
    ]);
    const summary = {
      deleted: clientErrorLogs.deleted,
      rateLimitBucketsDeleted: rateLimitBuckets,
      idempotencyKeysDeleted: idempotencyKeys,
      jobRunsDeleted: jobRuns,
    };
    return { rowsProcessed: Object.values(summary).reduce((a, b) => a + b, 0), summary };
  }
}
