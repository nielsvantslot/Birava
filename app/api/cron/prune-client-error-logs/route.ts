import { pruneClientErrorLogs } from "@/lib/commands/clientErrorLogCommands";
import { RateLimitBucketPruner } from "@/lib/rateLimit/RateLimitBucketPruner";
import { verifyCronRequest } from "@/lib/auth/verifyCronRequest";

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

  const [clientErrorLogResult, rateLimitBucketsDeleted] = await Promise.all([
    pruneClientErrorLogs(),
    RateLimitBucketPruner.prune(),
  ]);
  return Response.json({ ...clientErrorLogResult, rateLimitBucketsDeleted });
}
