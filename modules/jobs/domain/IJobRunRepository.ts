import type { JobName, JobResult } from "./JobDefinition";
import type { JobRunSnapshot } from "./JobHealth";

/** Where job runs are recorded. */
export interface IJobRunRepository {
  /** Records that a run started; returns its id. */
  start(job: JobName): Promise<string>;
  succeed(runId: string, result: JobResult, durationMs: number): Promise<void>;
  fail(runId: string, error: string, durationMs: number): Promise<void>;
  /** For each job, when it last succeeded and how it last failed. */
  snapshots(): Promise<JobRunSnapshot[]>;
  /** When the oldest remaining run started, or null if none was ever recorded. */
  firstRunAt(): Promise<Date | null>;
  /** Deletes runs started before `olderThan` (including any left RUNNING by a dead process). Returns how many. */
  prune(olderThan: Date): Promise<number>;
}
