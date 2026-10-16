import { ApiError } from "@/lib/gateway/ApiError";
import { createUserSession } from "@/modules/identity/server/session";
import { verifyCredentials } from "@/modules/identity/server/userQueries";
import { gateway, gatewayServices } from "@/modules/identity/server/gateway";
import { RateLimitGuard } from "@/lib/gateway/RateLimitGuard";
import { cancelAccountDeletion } from "@/modules/identity";
import { loginInput } from "@/modules/identity/contract/authContract";
import type { AuthResultDTO } from "@/lib/dtos";

// 30 attempts / 5 minutes / IP — slows credential-stuffing and brute force
// while staying well clear of real login volume. Raised from an initial 10:
// the E2E suite logs in from ~10 different specs against a plain localhost
// server with no reverse proxy, so every request lacks x-forwarded-for and
// collapses onto one shared "login:unknown" bucket (see the matching note
// on the signup limit in app/api/signup/route.ts) — 10 was already exceeded
// within a single CI run.
// The per-IP limit above trusts the client IP; a second limit keyed on the account itself stops password
// guessing against one email from rotating addresses. Generous enough that a real owner is never locked out.
const accountLimits = new RateLimitGuard(gatewayServices.rateLimiter, gatewayServices.logger);

export const POST = gateway.route.public(
  {
    name: "auth.login",
    body: loginInput,
    rateLimit: {
      bucket: "login",
      limit: 30,
      windowMs: 5 * 60 * 1000,
      scope: "ip",
      message: "Too many login attempts. Try again shortly.",
    },
  },
  async ({ input }): Promise<AuthResultDTO> => {
    const email = input.body.email.trim().toLowerCase();
    const password = input.body.password;

    if (!email || !password) throw ApiError.validation("Email and password are required.");

    await accountLimits.consume(
      { bucket: "login-account", limit: 20, windowMs: 15 * 60 * 1000, scope: "user", message: "Too many attempts for this account. Try again later." },
      "auth.login",
      email
    );

    const userId = await verifyCredentials(email, password);
    if (!userId) throw ApiError.unauthenticated("Invalid email or password.");

    await createUserSession(userId);

    // Logging back in during the GDPR-erasure grace period cancels it — the
    // purge cron only ever acts on accounts still flagged past the 7-day
    // window (modules/identity/application/userCommands.ts's requestAccountDeletion doc
    // comment), so this is the deletion's only cancellation path.
    const cancelledDeletion = await cancelAccountDeletion(userId);
    return { success: true, ...(cancelledDeletion && { cancelledDeletion: true }) };
  }
);
