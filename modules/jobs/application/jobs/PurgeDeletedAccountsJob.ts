import { purgeExpiredDeletedAccounts } from "@/modules/identity";
import { DAY_MS, type IJob, type JobResult } from "@/modules/jobs/domain/JobDefinition";

/** Erases accounts whose 7-day deletion grace period has passed. Scheduled daily. */
export class PurgeDeletedAccountsJob implements IJob {
  readonly name = "purge-deleted-accounts" as const;
  readonly expectedEveryMs = DAY_MS;
  readonly workBudget = "at most 25 accounts per run; a backlog drains over several runs";

  async run(): Promise<JobResult> {
    const { processed, failed } = await purgeExpiredDeletedAccounts();
    return { rowsProcessed: processed, summary: { processed, failed } };
  }
}
