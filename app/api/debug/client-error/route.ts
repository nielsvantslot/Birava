import { getCurrentUser } from "@/modules/identity/server/session";
import { gateway } from "@/modules/identity/server/gateway";
import { reportClientError } from "@/modules/diagnostics";
import { reportClientErrorInput } from "@/modules/diagnostics/contract/clientErrorContract";
import type { ReportClientErrorDTO } from "@/lib/dtos";

// The one client-side error beacon this app has — see
// components/client-error-reporter.tsx and public/sw.js. Deliberately
// ungated: a crash on /login, before any session exists, is exactly the
// kind of thing worth seeing, so this can't require a session the way most
// routes do. Best-effort by design — the reporter ignores the response, so
// a malformed body or a rate-limited flood is simply refused.
//
// Persisted rows are pruned after 30 days by
// app/api/cron/prune-client-error-logs/route.ts.
// Caps below bound storage on an intentionally unauthenticated endpoint —
// a flood or an unusually large stack/context still costs at most a few KB
// per row rather than being unbounded, and the rate limit bounds the rows.
const MAX_TEXT_LENGTH = 4000;
const MAX_CONTEXT_JSON_LENGTH = 4000;
const KNOWN_FIELDS = ["source", "message", "stack", "pageUrl", "userAgent"];

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export const POST = gateway.route.public(
  {
    name: "debug.client-error",
    body: reportClientErrorInput,
    // 120 reports / minute / IP: a crash loop is worth seeing, a flood is not.
    rateLimit: { bucket: "client-error", limit: 120, windowMs: 60 * 1000, scope: "ip", failOpen: true },
  },
  async ({ input }) => {
    const body = input.body;
    const context = Object.fromEntries(Object.entries(body).filter(([key]) => !KNOWN_FIELDS.includes(key)));
    const hasContext = Object.keys(context).length > 0;
    const report: ReportClientErrorDTO = {
      source: truncate(body.source ?? "unknown", 200),
      message: truncate(body.message, MAX_TEXT_LENGTH),
      stack: body.stack !== undefined ? truncate(body.stack, MAX_TEXT_LENGTH) : null,
      pageUrl: body.pageUrl !== undefined ? truncate(body.pageUrl, 2000) : null,
      userAgent: body.userAgent !== undefined ? truncate(body.userAgent, 500) : null,
      context: hasContext && JSON.stringify(context).length <= MAX_CONTEXT_JSON_LENGTH ? context : null,
    };

    const user = await getCurrentUser();
    await reportClientError(report, user?.id ?? null).catch(() => {});

    return null;
  }
);
