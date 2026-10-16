import { gateway } from "@/modules/identity/server/gateway";
import { verifyCronRequest } from "@/modules/identity/server/verifyCronRequest";
import { HealthReportFactory } from "@/modules/jobs/server/health";

// For uptime monitoring: 200 when the database answers, the newest backup is
// recent and every scheduled job has succeeded on schedule; 503 with the
// details otherwise. Public on purpose (a monitor has no session), but the
// public answer is only { ok }: backup age and job names are reconnaissance,
// so the full report needs the cron secret (the health-check workflow sends it).
export const GET = gateway.route.public(
  { name: "health", rateLimit: { bucket: "health", limit: 120, windowMs: 60 * 1000, scope: "ip", failOpen: true } },
  async ({ request }) => {
    const report = await HealthReportFactory.create().build();
    return Response.json(verifyCronRequest(request) ? report : { ok: report.ok }, {
      status: report.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
);
