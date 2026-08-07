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
// Caps below bound storage on an intentionally unauthenticated, unrate-
// limited endpoint (see comment above) — a flood or an unusually large
// stack/context still costs at most a few KB per row rather than being
// unbounded.
const MAX_TEXT_LENGTH = 4000;
const MAX_CONTEXT_JSON_LENGTH = 4000;

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

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
  const hasContext = Object.keys(context).length > 0;
  const report: ReportClientErrorDTO = {
    source: truncate(typeof b.source === "string" ? b.source : "unknown", 200),
    message: truncate(b.message as string, MAX_TEXT_LENGTH),
    stack: typeof b.stack === "string" ? truncate(b.stack, MAX_TEXT_LENGTH) : null,
    pageUrl: typeof b.pageUrl === "string" ? truncate(b.pageUrl, 2000) : null,
    userAgent: typeof b.userAgent === "string" ? truncate(b.userAgent, 500) : null,
    context: hasContext && JSON.stringify(context).length <= MAX_CONTEXT_JSON_LENGTH ? context : null,
  };

  const user = await getCurrentUser();
  await reportClientError(report, user?.id ?? null).catch(() => {});

  return new Response(null, { status: 204 });
}
