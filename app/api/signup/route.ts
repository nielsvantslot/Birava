import { createUser } from "@/lib/commands/userCommands";
import { JsonSerializer } from "@/lib/http/jsonSerializer";
import { AuthResultDTO, CreateUserDTO } from "@/lib/dtos";
import { RateLimiterFactory } from "@/lib/rateLimit/RateLimiterFactory";
import { ClientIpResolver } from "@/lib/rateLimit/ClientIpResolver";

// 30 accounts / hour / IP — legitimate signups are rare and one-off, so this
// is still a real deterrent against spam-account creation scripts, but high
// enough to survive the E2E suite: Playwright hits localhost directly with
// no reverse proxy, so every CI request collapses onto the same
// "signup:unknown" bucket (no x-forwarded-for to key on) and the suite's
// several TestUserFactory.ensure() calls all land in one shared window.
const SIGNUP_LIMIT = 30;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const ip = ClientIpResolver.resolve(request);
  const rateLimit = await RateLimiterFactory.create().consume(`signup:${ip}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS);
  if (!rateLimit.allowed) {
    return Response.json({ error: "Too many signups from this network. Try again later." } satisfies AuthResultDTO, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) },
    });
  }

  const input = await JsonSerializer.deserialize(request, CreateUserDTO);
  if (!input) {
    return Response.json({ error: "Invalid request body." } satisfies AuthResultDTO, { status: 400 });
  }

  const result = await createUser(input);
  if (result.error) {
    return Response.json({ error: result.error } satisfies AuthResultDTO, { status: 400 });
  }

  return Response.json({ success: true } satisfies AuthResultDTO);
}
