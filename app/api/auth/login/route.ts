import { createUserSession } from "@/lib/auth/session";
import { JsonSerializer } from "@/lib/http/jsonSerializer";
import { verifyCredentials } from "@/lib/queries/userQueries";
import { AuthResultDTO, LoginDTO } from "@/lib/dtos";
import { RateLimiterFactory } from "@/lib/rateLimit/RateLimiterFactory";
import { ClientIpResolver } from "@/lib/rateLimit/ClientIpResolver";

// 10 attempts / 5 minutes / IP — slows credential-stuffing and brute force
// without getting in the way of someone mistyping a password a few times.
const LOGIN_LIMIT = 10;
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
  return Response.json({ success: true } satisfies AuthResultDTO);
}
