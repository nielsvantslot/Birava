import { sendSessionReminders } from "@/lib/commands/sessionReminderCommands";

// Invoked by Vercel Cron on the schedule in vercel.json. Guarded by
// CRON_SECRET (set in the Vercel project's env vars) so this can't be
// triggered by anyone who finds the URL — Vercel sends this exact header
// on scheduled invocations, per Vercel's own cron auth convention.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { sent } = await sendSessionReminders();
  return Response.json({ sent });
}
