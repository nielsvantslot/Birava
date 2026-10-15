import { clearUserSession } from "@/modules/identity/server/session";
import { gateway } from "@/modules/identity/server/gateway";

// Public on purpose: signing out must work even when the session is already
// gone or expired. Clearing a cookie needs no rate limit.
export const POST = gateway.route.public({ name: "auth.logout", rateLimit: false }, async () => {
  await clearUserSession();
  return { success: true };
});
