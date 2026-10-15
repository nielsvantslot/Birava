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
        SELECT "finishedAt", error FROM "JobRun" r
        WHERE r.job = j.job AND r.status = 'FAILED'
        ORDER BY "finishedAt" DESC LIMIT 1
      ) f ON true
    `);

    return rows.map((row) => ({
      job: row.job as JobName,
      lastSuccessAt: row.lastSuccessAt,
      lastFailure: row.failedAt ? { at: row.failedAt, error: row.error } : null,
    }));
  }

  async firstRunAt(): Promise<Date | null> {
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
