import { sendSessionReminders } from "@/modules/notifications";
import { MINUTE_MS, type IJob, type JobResult } from "@/modules/jobs/domain/JobDefinition";

/**
 * Nudges people whose session has gone quiet to log what they have had since. Scheduled every 15 minutes, but
 * GitHub throttles scheduled workflows: observed gaps between runs are 1.5 to 5 hours. The health check expects a run
 * within three of these intervals, so it is set to 2 hours (6 hours allowed) rather than the nominal 15 minutes.
 */
export class SessionRemindersJob implements IJob {
  readonly name = "session-reminders" as const;
  readonly expectedEveryMs = 120 * MINUTE_MS;
  readonly workBudget = "every quiet session in its 1 to 4 hour window; deduped against reminders already sent";

  async run(): Promise<JobResult> {
    const { sent } = await sendSessionReminders();
    return { rowsProcessed: sent, summary: { sent } };
  }
}
