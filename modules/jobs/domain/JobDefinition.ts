/** Every scheduled job, by the name its runs are recorded under. */
export const JOB_NAMES = [
  "session-reminders",
  "cleanup-orphaned-blobs",
  "purge-deleted-accounts",
  "prune-client-error-logs",
] as const;

export type JobName = (typeof JOB_NAMES)[number];

/** What a finished run reports: how many rows it handled, plus named counts worth keeping. */
export type JobResult = {
  rowsProcessed: number;
  summary: Record<string, number>;
};

/**
 * A scheduled unit of work. GitHub Actions decides *when* (a CRON_SECRET-guarded
 * request to the job's route); the job decides *what*, and bounds its own work
 * per run so a function timeout never has to cut it off.
 */
export interface IJob {
  readonly name: JobName;
  /** How often it is scheduled. A job whose last success is older than a few of these is considered stuck. */
  readonly expectedEveryMs: number;
  /** The most one run will do; a backlog drains over several runs instead of one that times out. */
  readonly workBudget: string;
  run(): Promise<JobResult>;
}

export const MINUTE_MS = 60 * 1000;
export const DAY_MS = 24 * 60 * MINUTE_MS;

/** A job is stale once its last success is older than this many of its scheduled intervals. */
export const STALE_AFTER_INTERVALS = 3;
