import { createUserSession } from "@/lib/auth/session";
import { JsonSerializer } from "@/lib/http/jsonSerializer";
import { verifyCredentials } from "@/lib/queries/userQueries";
import { cancelAccountDeletion } from "@/lib/commands/userCommands";
import { AuthResultDTO, LoginDTO } from "@/lib/dtos";
import { RateLimiterFactory } from "@/lib/rateLimit/RateLimiterFactory";
import { ClientIpResolver } from "@/lib/rateLimit/ClientIpResolver";

// 30 attempts / 5 minutes / IP — slows credential-stuffing and brute force
// while staying well clear of real login volume. Raised from an initial 10:
// the E2E suite logs in from ~10 different specs against a plain localhost
// server with no reverse proxy, so every request lacks x-forwarded-for and
// collapses onto one shared "login:unknown" bucket (see the matching note
// on SIGNUP_LIMIT in app/api/signup/route.ts) — 10 was already exceeded
// within a single CI run.
const LOGIN_LIMIT = 30;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const ip = ClientIpResolver.resolve(request);
  const rateLimit = await RateLimiterFactory.create().consume(`login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!rateLimit.allowed) {
    return Response.json({ error: "Too many login attempts. Try again shortly." } satisfies AuthResultDTO, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) },
    });
  }

  const input = await JsonSerializer.deserialize(request, LoginDTO);
  if (!input) {
    return Response.json({ error: "Invalid request body." } satisfies AuthResultDTO, { status: 400 });
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return Response.json({ error: "Email and password are required." } satisfies AuthResultDTO, { status: 400 });
  }

  const userId = await verifyCredentials(email, password);
  if (!userId) {
    return Response.json({ error: "Invalid email or password." } satisfies AuthResultDTO, { status: 401 });
  }

  await createUserSession(userId);

  // Logging back in during the GDPR-erasure grace period cancels it — the
  // purge cron only ever acts on accounts still flagged past the 7-day
  // window (lib/commands/userCommands.ts's requestAccountDeletion doc
  // comment), so this is the deletion's only cancellation path.
  const cancelledDeletion = await cancelAccountDeletion(userId);
  return Response.json({ success: true, ...(cancelledDeletion && { cancelledDeletion: true }) } satisfies AuthResultDTO);
}
