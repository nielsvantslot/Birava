import { describe, expect, it } from "vitest";
import type { IJob } from "@/modules/jobs/domain/JobDefinition";
import { DAY_MS, MINUTE_MS } from "@/modules/jobs/domain/JobDefinition";
import type { IJobRunRepository } from "@/modules/jobs/domain/IJobRunRepository";
import { BACKUP_STALE_AFTER_HOURS, HealthReport } from "./HealthReport";

const NOW = new Date("2026-10-15T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const reminders: IJob = { name: "session-reminders", expectedEveryMs: 15 * MINUTE_MS, workBudget: "", run: async () => ({ rowsProcessed: 0, summary: {} }) };
const purge: IJob = { name: "purge-deleted-accounts", expectedEveryMs: DAY_MS, workBudget: "", run: async () => ({ rowsProcessed: 0, summary: {} }) };

function runsWith(lastSuccess: Record<string, Date | null>, trackingSince: Date | null = hoursAgo(24 * 30)): IJobRunRepository {
  return {
    start: async () => "",
    succeed: async () => {},
    fail: async () => {},
    prune: async () => 0,
    trackingSince: async () => trackingSince,
    snapshots: async () =>
      Object.entries(lastSuccess).map(([job, lastSuccessAt]) => ({ job: job as IJob["name"], lastSuccessAt, lastFailure: null })),
  };
}

const database = { ping: async () => {} };

describe("HealthReport", () => {
  it("is ok when the database answers, the backup is recent and every job is on schedule", async () => {
    const report = await new HealthReport(
      database,
      { latestBackupAt: async () => hoursAgo(10) },
      runsWith({ "session-reminders": hoursAgo(0.2), "purge-deleted-accounts": hoursAgo(12) }),
      [reminders, purge],
      () => NOW
    ).build();

    expect(report.ok).toBe(true);
    expect(report.backup).toMatchObject({ ok: true, ageHours: 10 });
    expect(report.jobs.map((j) => j.ok)).toEqual([true, true]);
  });

  it("goes unhealthy when a cron stops: its last success falls outside three intervals", async () => {
    const report = await new HealthReport(
      database,
      null,
      runsWith({ "session-reminders": hoursAgo(2), "purge-deleted-accounts": hoursAgo(12) }),
      [reminders, purge],
      () => NOW
    ).build();

    expect(report.ok).toBe(false);
    expect(report.jobs.find((j) => j.job === "session-reminders")).toMatchObject({ ok: false, reason: "stale" });
    expect(report.jobs.find((j) => j.job === "purge-deleted-accounts")?.ok).toBe(true);
  });

  it("goes unhealthy when the newest backup is older than the nightly cadence allows, or missing", async () => {
    const stale = await new HealthReport(database, { latestBackupAt: async () => hoursAgo(BACKUP_STALE_AFTER_HOURS + 1) }, runsWith({}), [], () => NOW).build();
    const missing = await new HealthReport(database, { latestBackupAt: async () => null }, runsWith({}), [], () => NOW).build();
    const broken = await new HealthReport(
      database,
      {
        latestBackupAt: async () => {
          throw new Error("blob unreachable");
        },
      },
      runsWith({}),
      [],
      () => NOW
    ).build();

    expect(stale.ok).toBe(false);
    expect(missing.backup).toMatchObject({ ok: false, error: "no backups found" });
    expect(broken.backup).toMatchObject({ ok: false, error: "blob unreachable" });
  });

  it("goes unhealthy when the database does not answer, and says so without throwing", async () => {
    const report = await new HealthReport(
      {
        ping: async () => {
          throw new Error("connection refused");
        },
      },
      null,
      runsWith({}),
      [],
      () => NOW
    ).build();

    expect(report.ok).toBe(false);
    expect(report.database).toEqual({ ok: false, error: "connection refused" });
  });

  it("omits the backup section where there are no backups (local, staging)", async () => {
    const report = await new HealthReport(database, null, runsWith({}), [], () => NOW).build();

    expect(report.backup).toBeUndefined();
    expect(report.ok).toBe(true);
  });

  it("reports every job as unknown, instead of failing the whole report, when the run table cannot be read", async () => {
    const broken = runsWith({});
    broken.snapshots = async () => {
      throw new Error("connection refused");
    };

    const report = await new HealthReport(database, null, broken, [reminders, purge], () => NOW).build();

    expect(report.ok).toBe(false);
    expect(report.jobs.map((j) => j.reason)).toEqual(["unknown", "unknown"]);
    expect(report.jobs[0]?.lastError).toBe("connection refused");
  });
});
