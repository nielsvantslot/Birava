import { cleanupOrphanedBlobs } from "@/lib/commands/photoCleanupCommands";

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
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await cleanupOrphanedBlobs();
  return Response.json(result);
}
