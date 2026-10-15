import { cleanupOrphanedBlobs } from "@/modules/media";
import { gateway } from "@/modules/identity/server/gateway";
import { CronRunLogger } from "@/lib/logging/CronRunLogger";

// sharp isn't involved, but @vercel/blob's list()/del() need Node, not edge.
export const runtime = "nodejs";

// Headroom above the 10s Hobby default — del() is a real network round trip
// per orphan, and MAX_DELETE_ATTEMPTS_PER_RUN (photoCleanupCommands.ts) is
// sized against this budget, not the other way around. 60 is the max
// configurable on standard Hobby without Fluid Compute.
export const maxDuration = 60;

// Invoked once daily by .github/workflows/cleanup-orphaned-blobs.yml —
// scheduled through GitHub Actions, same as session-reminders, rather than
// vercel.json's native cron, so every scheduled job lives on one platform.
// Guarded by CRON_SECRET (same value already used by session-reminders).
export const GET = gateway.route.cron({ name: "cron.cleanup-orphaned-blobs" }, async () => {
  const result = await CronRunLogger.run("cleanup-orphaned-blobs", cleanupOrphanedBlobs);
  return Response.json(result);
});
