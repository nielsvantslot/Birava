import { getCurrentUser } from "@/lib/auth/session";
import { reportClientError } from "@/lib/commands/clientErrorLogCommands";
import type { ReportClientErrorDTO } from "@/lib/dtos";

// The one client-side error beacon this app has — see
// components/client-error-reporter.tsx and public/sw.js. Deliberately
// ungated: a crash on /login, before any session exists, is exactly the
// kind of thing worth seeing, so this can't require getCurrentUser() the way
// most routes do. Best-effort by design — a malformed or missing body just
// gets dropped rather than surfaced back to a reporter that's already
// mid-crash-handling.
//
// Persisted rows are pruned after 30 days by
// app/api/cron/prune-client-error-logs/route.ts.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof (body as { message?: unknown }).message !== "string") {
    return new Response(null, { status: 204 });
  }

  const b = body as Record<string, unknown>;
  const KNOWN_FIELDS = ["source", "message", "stack", "pageUrl", "userAgent"];
  const context = Object.fromEntries(
    Object.entries(b).filter(([key]) => !KNOWN_FIELDS.includes(key))
  );
  const report: ReportClientErrorDTO = {
    source: typeof b.source === "string" ? b.source : "unknown",
    message: b.message as string,
    stack: typeof b.stack === "string" ? b.stack : null,
    pageUrl: typeof b.pageUrl === "string" ? b.pageUrl : null,
    userAgent: typeof b.userAgent === "string" ? b.userAgent : null,
    context: Object.keys(context).length > 0 ? context : null,
  };

  const user = await getCurrentUser();
  await reportClientError(report, user?.id ?? null).catch(() => {});

  return new Response(null, { status: 204 });
}
