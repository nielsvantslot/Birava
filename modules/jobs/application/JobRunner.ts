import type { ILogger } from "@/lib/logging/ILogger";
import type { IJob, JobResult } from "@/modules/jobs/domain/JobDefinition";
import type { IJobRunRepository } from "@/modules/jobs/domain/IJobRunRepository";

/**
 * Runs a job and records the run: start, then success with its result and
 * duration, or failure with the error. A failure is rethrown, so the route
 * still answers 500 and the scheduler (GitHub Actions) sees it fail. If
 * recording itself breaks, the job still runs: visibility must never be the
 * reason work doesn't happen.
 */
export class JobRunner {
  constructor(
    private readonly runs: IJobRunRepository,
    private readonly logger: ILogger
  ) {}

  async run(job: IJob): Promise<JobResult> {
    const logger = this.logger.child({ job: job.name });
    const started = Date.now();
    const runId = await this.record(logger, () => this.runs.start(job.name));
    logger.info("cron job started");

    try {
      const result = await job.run();
      const durationMs = Date.now() - started;
      logger.info("cron job finished", { durationMs, result });
      if (runId) await this.record(logger, () => this.runs.succeed(runId, result, durationMs));
      return result;
    } catch (error) {
      const durationMs = Date.now() - started;
      logger.error("cron job failed", { durationMs, error });
      if (runId) await this.record(logger, () => this.runs.fail(runId, error instanceof Error ? error.message : String(error), durationMs));
      throw error;
    }
  }

  private async record<T>(logger: ILogger, write: () => Promise<T>): Promise<T | null> {
    try {
      return await write();
    } catch (error) {
      logger.warn("could not record the job run", { error });
      return null;
    }
  }
}
