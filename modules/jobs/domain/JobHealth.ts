import { STALE_AFTER_INTERVALS, type IJob, type JobName } from "./JobDefinition";

/** The last runs of one job, as read from the run table. */
export type JobRunSnapshot = {
  job: JobName;
  lastSuccessAt: Date | null;
  lastFailure: { at: Date; error: string | null } | null;
};

export type JobHealthStatus = {
  job: JobName;
  ok: boolean;
  lastSuccessAt: string | null;
  /** How long ago the last success was, in minutes; null if it never succeeded. */
  lastSuccessAgeMinutes: number | null;
  /** Whether the most recent failed run is newer than the last success. Details stay in the logs and the run table, not in a public body. */
  lastRunFailed: boolean;
  reason: "ok" | "not-yet-run" | "never-ran" | "stale" | "failing" | "unknown";
};

/**
 * Decides whether a job is on schedule: it has succeeded within a few of its
 * own intervals. A job that has never succeeded gets the same allowance
 * counted from when job tracking began (`trackingSince`: when the run table
 * was created, so it holds even if no job has ever run), so a fresh deploy does
 * not report every daily job as broken before its first run.
 * Pure, so it is easy to test.
 */
export class JobHealth {
  static evaluate(
    job: Pick<IJob, "name" | "expectedEveryMs">,
    snapshot: JobRunSnapshot | undefined,
    now: Date,
    trackingSince: Date | null
  ): JobHealthStatus {
    const lastSuccessAt = snapshot?.lastSuccessAt ?? null;
    const failure = snapshot?.lastFailure ?? null;
    const lastRunFailed = failure !== null && (lastSuccessAt === null || failure.at.getTime() > lastSuccessAt.getTime());
    const allowanceMs = job.expectedEveryMs * STALE_AFTER_INTERVALS;

    // A job that fails every run is broken now, however recent its last success was.
    if (lastRunFailed) {
      return {
        job: job.name,
        ok: false,
        lastSuccessAt: lastSuccessAt?.toISOString() ?? null,
        lastSuccessAgeMinutes: lastSuccessAt ? Math.round((now.getTime() - lastSuccessAt.getTime()) / 60_000) : null,
        lastRunFailed,
        reason: "failing",
      };
    }

    if (!lastSuccessAt) {
      const waitedMs = trackingSince ? now.getTime() - trackingSince.getTime() : 0;
      const stillWithinAllowance = waitedMs <= allowanceMs;
      return {
        job: job.name,
        ok: stillWithinAllowance,
        lastSuccessAt: null,
        lastSuccessAgeMinutes: null,
        lastRunFailed,
        reason: stillWithinAllowance ? "not-yet-run" : "never-ran",
      };
    }

    const ageMs = now.getTime() - lastSuccessAt.getTime();
    const ok = ageMs <= allowanceMs;
    return {
      job: job.name,
      ok,
      lastSuccessAt: lastSuccessAt.toISOString(),
      lastSuccessAgeMinutes: Math.round(ageMs / 60_000),
      lastRunFailed,
      reason: ok ? "ok" : "stale",
    };
  }
}
