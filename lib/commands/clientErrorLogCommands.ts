import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ReportClientErrorDTO, ClientErrorPruneResultDTO } from "@/lib/dtos";

// How long a captured error is worth keeping around to look at — long enough
// to catch something a user mentions days later, short enough that this
// stays a bounded table on Neon's free-tier storage rather than growing
// forever. No tiered retention like lib/backupRetention.ts: unlike a backup,
// an old error report has no independent value once it's aged out.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Persists one client-side error report (components/client-error-reporter.tsx,
 * forwarded from public/sw.js for errors thrown inside the service worker).
 * userId is the caller's *authenticated* id, not anything client-supplied —
 * this endpoint has no auth gate (a crash on /login is exactly the kind of
 * thing worth seeing), so the report itself can't be trusted to say who hit it.
 */
export async function reportClientError(
  input: ReportClientErrorDTO,
  userId: string | null
): Promise<void> {
  await db.clientErrorLog.create({
    data: {
      source: input.source,
      message: input.message,
      stack: input.stack,
      pageUrl: input.pageUrl,
      userAgent: input.userAgent,
      userId,
      context: input.context ? (input.context as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}

/** Deletes reports older than RETENTION_MS. Run daily by the prune-client-error-logs cron. */
export async function pruneClientErrorLogs(): Promise<ClientErrorPruneResultDTO> {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  const { count } = await db.clientErrorLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return { deleted: count };
}
