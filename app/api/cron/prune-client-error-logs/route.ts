import { pruneClientErrorLogs } from "@/lib/commands/clientErrorLogCommands";

// Invoked once daily by .github/workflows/prune-client-error-logs.yml —
// GitHub Actions, same as session-reminders/cleanup-orphaned-blobs, rather
// than vercel.json's native cron. Guarded by CRON_SECRET (same value already
// used by the other cron routes).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await pruneClientErrorLogs();
  return Response.json(result);
}
