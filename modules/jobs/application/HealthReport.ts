import type { IJob } from "@/modules/jobs/domain/JobDefinition";
import { JobHealth, type JobHealthStatus } from "@/modules/jobs/domain/JobHealth";
import type { IJobRunRepository } from "@/modules/jobs/domain/IJobRunRepository";

/** Answers "can the app reach its database?" with a cheap round trip. */
export interface IDatabaseProbe {
  ping(): Promise<void>;
}

/** Answers "when was the newest database backup written?" (null when there is none). */
export interface IBackupProbe {
  latestBackupAt(): Promise<Date | null>;
}

export type HealthReportBody = {
  ok: boolean;
  checkedAt: string;
  database: { ok: boolean; error?: string };
  /** Absent where backups do not apply (local, staging). */
  backup?: { ok: boolean; latestAt: string | null; ageHours: number | null; error?: string };
  jobs: JobHealthStatus[];
};

/** A nightly backup is overdue once the newest one is older than this. */
export const BACKUP_STALE_AFTER_HOURS = 36;
const DATABASE_TIMEOUT_MS = 3000;

/**
 * What /api/health reports: the database answers, the newest backup is recent,
 * and every scheduled job has succeeded within a few of its intervals. An
 * uptime monitor (or the health-check workflow) alerts on a non-200, so a
 * stopped cron or backup is noticed within its own interval, not by a user.
 */
export class HealthReport {
  constructor(
    private readonly database: IDatabaseProbe,
    private readonly backups: IBackupProbe | null,
    private readonly runs: IJobRunRepository,
    private readonly jobs: readonly IJob[],
    private readonly now: () => Date = () => new Date()
  ) {}

  async build(): Promise<HealthReportBody> {
    const checkedAt = this.now();
    const [database, backup, jobs] = await Promise.all([this.checkDatabase(), this.checkBackup(checkedAt), this.checkJobs(checkedAt)]);

    const ok = database.ok && (backup?.ok ?? true) && jobs.every((job) => job.ok);
    return { ok, checkedAt: checkedAt.toISOString(), database, ...(backup ? { backup } : {}), jobs };
  }

  private async checkDatabase(): Promise<HealthReportBody["database"]> {
    try {
      await Promise.race([
        this.database.ping(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), DATABASE_TIMEOUT_MS)),
      ]);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "unreachable" };
    }
  }

  private async checkBackup(now: Date): Promise<HealthReportBody["backup"] | undefined> {
    if (!this.backups) return undefined;
    try {
      const latest = await this.backups.latestBackupAt();
      if (!latest) return { ok: false, latestAt: null, ageHours: null, error: "no backups found" };
      const ageHours = Math.round(((now.getTime() - latest.getTime()) / 3_600_000) * 10) / 10;
      return { ok: ageHours <= BACKUP_STALE_AFTER_HOURS, latestAt: latest.toISOString(), ageHours };
    } catch (error) {
      return { ok: false, latestAt: null, ageHours: null, error: error instanceof Error ? error.message : "could not list backups" };
    }
  }

  private async checkJobs(now: Date): Promise<JobHealthStatus[]> {
    const [snapshots, trackingSince] = await Promise.all([this.runs.snapshots(), this.runs.firstRunAt()]);
    const byJob = new Map(snapshots.map((snapshot) => [snapshot.job, snapshot]));
    return this.jobs.map((job) => JobHealth.evaluate(job, byJob.get(job.name), now, trackingSince));
  }
}
