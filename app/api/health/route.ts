import { gateway } from "@/modules/identity/server/gateway";
import { HealthReportFactory } from "@/modules/jobs/server/health";

// For uptime monitoring: 200 when the database answers, the newest backup is
// recent and every scheduled job has succeeded on schedule; 503 with the
// details otherwise. Public on purpose (a monitor has no session) and it
// reveals nothing secret: names, timestamps and ages only.
export const GET = gateway.route.public(
  { name: "health", rateLimit: { bucket: "health", limit: 120, windowMs: 60 * 1000, scope: "ip", failOpen: true } },
  async () => {
    const report = await HealthReportFactory.create().build();
    return Response.json(report, {
      status: report.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
);
