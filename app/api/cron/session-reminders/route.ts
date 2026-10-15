import { gateway } from "@/modules/identity/server/gateway";
import { jobRunner, jobs } from "@/modules/jobs/server/jobs";

// Invoked every 15 min by .github/workflows/session-reminders.yml — not
// Vercel Cron, since the Hobby plan only allows once-a-day schedules there
// (see vercel.json's git history). Guarded by CRON_SECRET (must match the
// same value in the Vercel project's env vars and this repo's Actions
// secrets) so this can't be triggered by anyone who finds the URL.
export const GET = gateway.route.cron({ name: "cron.session-reminders" }, () => jobRunner.run(jobs.sessionReminders));
