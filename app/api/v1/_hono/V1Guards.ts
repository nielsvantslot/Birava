import type { MiddlewareHandler } from "hono";
import { ApiError } from "@/lib/gateway/ApiError";
import { IdempotencyGuard } from "@/lib/gateway/IdempotencyGuard";
import { DEFAULT_USER_RATE_LIMIT, RateLimitGuard } from "@/lib/gateway/RateLimitGuard";
import { OriginGuard } from "@/lib/gateway/OriginGuard";
import type { IpRateLimitSpec } from "@/lib/gateway/Models";
import type { V1Env, V1Services } from "./V1Services";

/**
 * The per-endpoint steps of the gateway, as Hono middleware: authenticate,
 * then for a mutation the origin check (cookie sessions only: a bearer token
 * is not sent by the browser on its own, so it cannot be ridden by another
 * site), the rate limit and the Idempotency-Key. Same classes as the web
 * gateway uses, so /api/v1 and the web UI enforce identical rules.
 */
export class V1Guards {
  private readonly rateLimits: RateLimitGuard;
  private readonly idempotency: IdempotencyGuard;

  constructor(private readonly services: V1Services) {
    this.rateLimits = new RateLimitGuard(services.rateLimiter, services.logger);
    this.idempotency = new IdempotencyGuard(services.idempotency, services.logger);
  }

  /** For endpoints that need a signed-in user. */
  readonly requireUser: MiddlewareHandler<V1Env> = async (c, next) => {
    const user = await this.services.authenticate();
    if (!user) throw ApiError.unauthenticated();
    c.set("user", user);

    if (!OriginGuard.isUnsafe(c.req.method)) return next();
    // Only a request that carries a bearer token and no session cookie is immune to cross-site forgery: a browser
    // attaches cookies by itself, so a cookie session (which getCurrentUser prefers) always gets the origin check,
    // whatever other headers come with it.
    if (V1Guards.hasSessionCookie(c.req.header("cookie")) || !c.req.header("authorization")) OriginGuard.assertSameOrigin(c.req.raw);

    const routeName = `v1:${c.req.method}:${c.req.routePath}`;
    // The limit is spent inside the idempotent run, so replaying a response (a safe retry) costs nothing.
    return this.idempotency.run(c.req.raw, user.id, routeName, async () => {
      await this.rateLimits.consume(this.services.mutationRateLimit ?? DEFAULT_USER_RATE_LIMIT, routeName, user.id);
      await next();
      return c.res;
    });
  };

  /** True when the Cookie header carries this app's session cookie. */
  static hasSessionCookie(cookieHeader: string | undefined): boolean {
    return /(?:^|;\s*)birava_session=/.test(cookieHeader ?? "");
  }

  /** Counts one sign-in attempt against an account, so rotating IPs does not buy unlimited guesses at one password. */
  async consumeAccountAttempt(email: string): Promise<void> {
    await this.rateLimits.consume(
      { bucket: "v1-token-account", limit: 10, windowMs: 15 * 60 * 1000, scope: "user", message: "Too many attempts for this account. Try again later." },
      "v1-token-account",
      email
    );
  }

  /** For public endpoints (sign in): limited per IP. */
  forPublic(spec: IpRateLimitSpec): MiddlewareHandler<V1Env> {
    return async (c, next) => {
      await this.rateLimits.consume(spec, `v1:${c.req.method}:${c.req.routePath}`, this.services.clientIp(c.req.raw));
      return next();
    };
  }
}
