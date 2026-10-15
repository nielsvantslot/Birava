import { pruneClientErrorLogs } from "@/modules/diagnostics";
import { RateLimitBucketPruner } from "@/lib/rateLimit/RateLimitBucketPruner";
import { verifyCronRequest } from "@/modules/identity/server/verifyCronRequest";
import { CronRunLogger } from "@/lib/logging/CronRunLogger";

// Invoked once daily by .github/workflows/prune-client-error-logs.yml —
// GitHub Actions, same as session-reminders/cleanup-orphaned-blobs, rather
// than vercel.json's native cron. Guarded by CRON_SECRET (same value already
// used by the other cron routes). Also prunes RateLimitBucket — sharing this
// cron's schedule rather than standing up a second one for another small,
// unrelated table.
export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await CronRunLogger.run("prune-client-error-logs", async () => {
    const [clientErrorLogResult, rateLimitBucketsDeleted] = await Promise.all([
      pruneClientErrorLogs(),
      RateLimitBucketPruner.prune(),
    ]);
    return { ...clientErrorLogResult, rateLimitBucketsDeleted };
  });
  return Response.json(result);
}
