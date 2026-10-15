import { ApiError } from "@/lib/gateway/ApiError";
import { createUser } from "@/modules/identity";
import { gateway } from "@/modules/identity/server/gateway";
import { signupInput } from "@/modules/identity/contract/authContract";
import type { AuthResultDTO } from "@/lib/dtos";

// 30 accounts / hour / IP — legitimate signups are rare and one-off, so this
// is still a real deterrent against spam-account creation scripts, but high
// enough to survive the E2E suite: Playwright hits localhost directly with
// no reverse proxy, so every CI request collapses onto the same
// "signup:unknown" bucket (no x-forwarded-for to key on) and the suite's
// several TestUserFactory.ensure() calls all land in one shared window.
export const POST = gateway.route.public(
  {
    name: "auth.signup",
    body: signupInput,
    rateLimit: {
      bucket: "signup",
      limit: 30,
      windowMs: 60 * 60 * 1000,
      scope: "ip",
      message: "Too many signups from this network. Try again later.",
    },
  },
  async ({ input }): Promise<AuthResultDTO> => {
    const result = await createUser(input.body);
    if (result.error) throw ApiError.validation(result.error);
    return { success: true };
  }
);
