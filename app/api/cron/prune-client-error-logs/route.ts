import { pruneClientErrorLogs } from "@/modules/diagnostics";
import { db } from "@/lib/db";
import { PostgresIdempotencyStore } from "@/lib/gateway/PostgresIdempotencyStore";
import { RateLimitBucketPruner } from "@/lib/rateLimit/RateLimitBucketPruner";
import { gateway } from "@/modules/identity/server/gateway";
import { CronRunLogger } from "@/lib/logging/CronRunLogger";

// Invoked once daily by .github/workflows/prune-client-error-logs.yml —
// GitHub Actions, same as session-reminders/cleanup-orphaned-blobs, rather
// than vercel.json's native cron. Guarded by CRON_SECRET (same value already
// used by the other cron routes). Also prunes RateLimitBucket and expired
// IdempotencyKey rows — sharing this cron's schedule rather than standing up
// a second one for other small, unrelated tables.
export const GET = gateway.route.cron({ name: "cron.prune-client-error-logs" }, async () => {
  const result = await CronRunLogger.run("prune-client-error-logs", async () => {
    const [clientErrorLogResult, rateLimitBucketsDeleted, idempotencyKeysDeleted] = await Promise.all([
      pruneClientErrorLogs(),
      RateLimitBucketPruner.prune(),
      new PostgresIdempotencyStore(db).pruneExpired(),
    ]);
    return { ...clientErrorLogResult, rateLimitBucketsDeleted, idempotencyKeysDeleted };
  });
  return Response.json(result);
});
