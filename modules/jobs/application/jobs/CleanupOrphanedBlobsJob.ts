import { cleanupOrphanedBlobs } from "@/modules/media";
import { DAY_MS, type IJob, type JobResult } from "@/modules/jobs/domain/JobDefinition";

/** Deletes uploaded photos and avatars nothing references, past a 7-day grace period. Scheduled daily. */
export class CleanupOrphanedBlobsJob implements IJob {
  readonly name = "cleanup-orphaned-blobs" as const;
  readonly expectedEveryMs = DAY_MS;
  readonly workBudget = "at most 200 delete attempts per run; a backlog drains over several runs";

  async run(): Promise<JobResult> {
    const { scanned, deleted, failed } = await cleanupOrphanedBlobs();
    return { rowsProcessed: scanned, summary: { scanned, deleted, failed } };
  }
}
