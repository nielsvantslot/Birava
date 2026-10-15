import { db } from "@/lib/db";
import { Env } from "@/lib/env/Env";
import { listBackups } from "@/lib/backup/backupBlobs";
import { HealthReport } from "@/modules/jobs/application/HealthReport";
import { allJobs, jobRunRepository } from "@/modules/jobs/server/jobs";

/**
 * Builds the health report for this deployment. Backups only exist for
 * production (staging data is disposable), and jobs only run where the
 * schedulers point, so a local or CI run reports just the database.
 */
export class HealthReportFactory {
  static create(): HealthReport {
    const deployed = Env.server.VERCEL_ENV !== undefined;
    const hasBackups = Env.server.VERCEL_ENV === "production";

    return new HealthReport(
      { ping: async () => void (await db.$queryRaw`SELECT 1`) },
      hasBackups ? { latestBackupAt: async () => (await listBackups())[0]?.uploadedAt ?? null } : null,
      jobRunRepository,
      deployed ? allJobs : []
    );
  }
}
