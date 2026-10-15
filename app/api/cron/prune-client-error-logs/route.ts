import { gateway } from "@/modules/identity/server/gateway";
import { jobRunner, jobs } from "@/modules/jobs/server/jobs";

// Invoked once daily by .github/workflows/prune-client-error-logs.yml —
// GitHub Actions, same as session-reminders/cleanup-orphaned-blobs, rather
// than vercel.json's native cron. Guarded by CRON_SECRET (same value already
// used by the other cron routes). Also prunes RateLimitBucket and expired
// IdempotencyKey rows — sharing this cron's schedule rather than standing up
// a second one for other small, unrelated tables.
export const GET = gateway.route.cron({ name: "cron.prune-client-error-logs" }, () => jobRunner.run(jobs.pruneStaleRows));
