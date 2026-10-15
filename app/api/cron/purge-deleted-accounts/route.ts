import { purgeExpiredDeletedAccounts } from "@/modules/identity";
import { gateway } from "@/modules/identity/server/gateway";
import { CronRunLogger } from "@/lib/logging/CronRunLogger";

// @vercel/blob's del() (via drinkPhotoService/avatarPhotoService) needs Node, not edge.
export const runtime = "nodejs";

// Headroom above the 10s Hobby default — blob deletion is a real network
// round trip per account, and MAX_ACCOUNTS_PURGED_PER_RUN
// (modules/identity/application/userCommands.ts) is sized against this budget, not the
// other way around. 60 is the max configurable on standard Hobby without
// Fluid Compute.
export const maxDuration = 60;

// Invoked once daily by .github/workflows/purge-deleted-accounts.yml —
// scheduled through GitHub Actions, same as session-reminders and
// cleanup-orphaned-blobs, rather than vercel.json's native cron, so every
// scheduled job lives on one platform. Guarded by CRON_SECRET (same value
// already used by the other cron routes).
export const GET = gateway.route.cron({ name: "cron.purge-deleted-accounts" }, async () => {
  const result = await CronRunLogger.run("purge-deleted-accounts", purgeExpiredDeletedAccounts);
  return Response.json(result);
});
