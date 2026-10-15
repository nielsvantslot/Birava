import { Prisma, type PrismaClient } from "@prisma/client";
import type { IJobRunRepository } from "@/modules/jobs/domain/IJobRunRepository";
import { JOB_NAMES, type JobName, type JobResult } from "@/modules/jobs/domain/JobDefinition";
import type { JobRunSnapshot } from "@/modules/jobs/domain/JobHealth";

export class PrismaJobRunRepository implements IJobRunRepository {
  constructor(private readonly db: PrismaClient) {}

  async start(job: JobName): Promise<string> {
    const run = await this.db.jobRun.create({ data: { job }, select: { id: true } });
    return run.id;
  }

  async succeed(runId: string, result: JobResult, durationMs: number): Promise<void> {
    await this.db.jobRun.update({
      where: { id: runId },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        durationMs,
        rowsProcessed: result.rowsProcessed,
        summary: result.summary,
      },
    });
  }

  async fail(runId: string, error: string, durationMs: number): Promise<void> {
    await this.db.jobRun.update({
      where: { id: runId },
      data: { status: "FAILED", finishedAt: new Date(), durationMs, error: error.slice(0, 2000) },
    });
  }

  async snapshots(): Promise<JobRunSnapshot[]> {
    const rows = await this.db.$queryRaw<
      { job: string; lastSuccessAt: Date | null; failedAt: Date | null; error: string | null }[]
    >(Prisma.sql`
      SELECT j.job,
        (SELECT max("finishedAt") FROM "JobRun" r WHERE r.job = j.job AND r.status = 'SUCCEEDED') AS "lastSuccessAt",
        f."finishedAt" AS "failedAt",
        f.error AS error
      FROM unnest(${[...JOB_NAMES]}::text[]) AS j(job)
      LEFT JOIN LATERAL (
        -- A failed run, or one still RUNNING long after it started: the process was killed (timeout, crash) before it could record anything.
        SELECT COALESCE("finishedAt", "startedAt") AS "finishedAt",
               COALESCE(error, 'run started but never finished (timed out or crashed)') AS error
        FROM "JobRun" r
        WHERE r.job = j.job
          AND (r.status = 'FAILED' OR (r.status = 'RUNNING' AND r."startedAt" < now() - interval '10 minutes'))
        ORDER BY COALESCE("finishedAt", "startedAt") DESC LIMIT 1
      ) f ON true
    `);

    return rows.map((row) => ({
      job: row.job as JobName,
      lastSuccessAt: row.lastSuccessAt,
      lastFailure: row.failedAt ? { at: row.failedAt, error: row.error } : null,
    }));
  }

  /**
   * When the run table was created (the job_runs migration's finish time), so
   * the allowance for a job that has never succeeded starts from the deploy,
   * not from the first run, which may never come if the schedulers are broken.
   * Falls back to the oldest recorded run where the migration table is absent.
   */
  async trackingSince(): Promise<Date | null> {
    const migrated = await this.db
      .$queryRaw<{ finishedAt: Date | null }[]>`SELECT finished_at AS "finishedAt" FROM _prisma_migrations WHERE migration_name LIKE '%job_runs' LIMIT 1`
      .catch(() => []);
    if (migrated[0]?.finishedAt) return migrated[0].finishedAt;

    const first = await this.db.jobRun.findFirst({ orderBy: { startedAt: "asc" }, select: { startedAt: true } });
    return first?.startedAt ?? null;
  }

  async prune(olderThan: Date): Promise<number> {
    const { count } = await this.db.jobRun.deleteMany({
      where: { startedAt: { lt: olderThan } },
    });
    return count;
  }
}
