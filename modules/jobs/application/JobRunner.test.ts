import { describe, expect, it, vi } from "vitest";
import type { ILogger } from "@/lib/logging/ILogger";
import type { IJob, JobResult } from "@/modules/jobs/domain/JobDefinition";
import { DAY_MS } from "@/modules/jobs/domain/JobDefinition";
import type { IJobRunRepository } from "@/modules/jobs/domain/IJobRunRepository";
import { JobRunner } from "./JobRunner";

const silentLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
};

class FakeRuns implements IJobRunRepository {
  readonly calls: string[] = [];
  succeeded: { result: JobResult; durationMs: number } | null = null;
  failed: { error: string } | null = null;
  async start(job: string) {
    this.calls.push(`start:${job}`);
    return "run-1";
  }
  async succeed(_id: string, result: JobResult, durationMs: number) {
    this.calls.push("succeed");
    this.succeeded = { result, durationMs };
  }
  async fail(_id: string, error: string) {
    this.calls.push("fail");
    this.failed = { error };
  }
  async snapshots() {
    return [];
  }
  async firstRunAt() {
    return null;
  }
  async prune() {
    return 0;
  }
}

const job = (run: () => Promise<JobResult>): IJob => ({
  name: "purge-deleted-accounts",
  expectedEveryMs: DAY_MS,
  workBudget: "test",
  run,
});

describe("JobRunner", () => {
  it("records a started run, then its result and duration, and returns the result", async () => {
    const runs = new FakeRuns();

    const result = await new JobRunner(runs, silentLogger).run(job(async () => ({ rowsProcessed: 3, summary: { processed: 3 } })));

    expect(result).toEqual({ rowsProcessed: 3, summary: { processed: 3 } });
    expect(runs.calls).toEqual(["start:purge-deleted-accounts", "succeed"]);
    expect(runs.succeeded?.result.summary).toEqual({ processed: 3 });
    expect(runs.succeeded?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records a failure with its message and rethrows, so the route still answers 500", async () => {
    const runs = new FakeRuns();

    await expect(
      new JobRunner(runs, silentLogger).run(
        job(async () => {
          throw new Error("storage unreachable");
        })
      )
    ).rejects.toThrow("storage unreachable");

    expect(runs.calls).toEqual(["start:purge-deleted-accounts", "fail"]);
    expect(runs.failed?.error).toBe("storage unreachable");
  });

  it("still runs the job when recording is broken: visibility must never stop the work", async () => {
    const runs = new FakeRuns();
    runs.start = async () => {
      throw new Error("job table missing");
    };
    const run = vi.fn(async () => ({ rowsProcessed: 1, summary: {} }));

    const result = await new JobRunner(runs, silentLogger).run(job(run));

    expect(run).toHaveBeenCalledOnce();
    expect(result.rowsProcessed).toBe(1);
    expect(runs.calls).toEqual([]);
  });
});
