import { clearUserSession } from "@/lib/auth/session";

export async function POST() {
  await clearUserSession();
  return Response.json({ success: true });
}
