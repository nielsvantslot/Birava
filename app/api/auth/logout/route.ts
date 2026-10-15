import { clearUserSession } from "@/modules/identity/server/session";

export async function POST() {
  await clearUserSession();
  return Response.json({ success: true });
}
