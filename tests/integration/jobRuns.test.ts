import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { GET as health } from "@/app/api/health/route";
import { LoggerFactory } from "@/lib/logging/LoggerFactory";
import { JobRunner } from "@/modules/jobs/application/JobRunner";
import { DAY_MS, type IJob, type JobResult } from "@/modules/jobs/domain/JobDefinition";
import { PrismaJobRunRepository } from "@/modules/jobs/infrastructure/PrismaJobRunRepository";

const runs = new PrismaJobRunRepository(db);
const runner = new JobRunner(runs, LoggerFactory.create("test"));

const job = (name: IJob["name"], run: () => Promise<JobResult>): IJob => ({ name, expectedEveryMs: DAY_MS, workBudget: "", run });

describe("job runs in Postgres", () => {
  it("records a successful run with its duration, rows and summary", async () => {
    await runner.run(job("purge-deleted-accounts", async () => ({ rowsProcessed: 4, summary: { processed: 3, failed: 1 } })));

    const row = await db.jobRun.findFirstOrThrow({ where: { job: "purge-deleted-accounts" } });
    expect(row).toMatchObject({ status: "SUCCEEDED", rowsProcessed: 4, summary: { processed: 3, failed: 1 }, error: null });
    expect(row.finishedAt).not.toBeNull();
    expect(row.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records a failed run with its error", async () => {
    await expect(
      runner.run(
        job("session-reminders", async () => {
          throw new Error("push service down");
        })
      )
    ).rejects.toThrow("push service down");

    expect(await db.jobRun.findFirstOrThrow({ where: { job: "session-reminders" } })).toMatchObject({
      status: "FAILED",
      error: "push service down",
    });
  });

  it("answers, per job, when it last succeeded and how it last failed", async () => {
    await runner.run(job("session-reminders", async () => ({ rowsProcessed: 0, summary: {} })));
    await runner.run(job("session-reminders", async () => ({ rowsProcessed: 0, summary: {} }))).catch(() => {});
    await runner
      .run(
        job("cleanup-orphaned-blobs", async () => {
          throw new Error("blob list failed");
        })
      )
      .catch(() => {});

    const snapshots = new Map((await runs.snapshots()).map((s) => [s.job, s]));

    expect(snapshots.get("session-reminders")?.lastSuccessAt).toBeInstanceOf(Date);
    expect(snapshots.get("session-reminders")?.lastFailure).toBeNull();
    expect(snapshots.get("cleanup-orphaned-blobs")).toMatchObject({ lastSuccessAt: null, lastFailure: { error: "blob list failed" } });
    expect(snapshots.get("prune-client-error-logs")).toMatchObject({ lastSuccessAt: null, lastFailure: null });
    expect(snapshots.size).toBe(4);
  });

  it("prunes runs older than the cutoff, including one a dead process left RUNNING", async () => {
    await db.jobRun.create({ data: { job: "session-reminders", status: "RUNNING", startedAt: new Date(Date.now() - 40 * DAY_MS) } });
    await db.jobRun.create({ data: { job: "session-reminders", status: "SUCCEEDED", startedAt: new Date() } });

    expect(await runs.prune(new Date(Date.now() - 30 * DAY_MS))).toBe(1);
    expect(await db.jobRun.count()).toBe(1);
  });
});

describe("GET /api/health", () => {
  it("answers 200 with the database check when nothing is deployed", async () => {
    const response = await health(new Request("http://app.test/api/health", { headers: { host: "app.test" } }), { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as { ok: boolean; database: { ok: boolean }; jobs: unknown[] };
    expect(body).toMatchObject({ ok: true, database: { ok: true }, jobs: [] });
  });
});
