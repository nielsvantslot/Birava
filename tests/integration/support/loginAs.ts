import { createUserSession } from "@/lib/auth/session";

/**
 * Logs a test in as the given user via the real session-creation code path
 * (writes a Session row, sets the birava_session cookie on the shared fake
 * cookie store from tests/integration/setup.ts) — so getCurrentUser() sees
 * a real, valid session, exactly as it would in production.
 */
export async function loginAs(userId: string): Promise<void> {
  await createUserSession(userId);
}
