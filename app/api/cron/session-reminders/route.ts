import { sendSessionReminders } from "@/lib/commands/sessionReminderCommands";
import { verifyCronRequest } from "@/lib/auth/verifyCronRequest";

// Invoked every 15 min by .github/workflows/session-reminders.yml — not
// Vercel Cron, since the Hobby plan only allows once-a-day schedules there
// (see vercel.json's git history). Guarded by CRON_SECRET (must match the
// same value in the Vercel project's env vars and this repo's Actions
// secrets) so this can't be triggered by anyone who finds the URL.
export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { sent } = await sendSessionReminders();
  return Response.json({ sent });
}
