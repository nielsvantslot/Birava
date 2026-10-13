import { LoggerFactory } from "@/lib/logging/LoggerFactory";

/** Wraps a cron job so every run logs its start, outcome and duration, and failures are never silent. */
export class CronRunLogger {
  private static readonly logger = LoggerFactory.create("cron");

  static async run<T>(job: string, work: () => Promise<T>): Promise<T> {
    const started = Date.now();
    CronRunLogger.logger.info("cron job started", { job });
    try {
      const result = await work();
      CronRunLogger.logger.info("cron job finished", { job, durationMs: Date.now() - started, result });
      return result;
    } catch (error) {
      CronRunLogger.logger.error("cron job failed", { job, durationMs: Date.now() - started, error });
      throw error;
    }
  }
}
