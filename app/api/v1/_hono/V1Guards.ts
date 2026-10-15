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
    if (!c.req.header("authorization")) OriginGuard.assertSameOrigin(c.req.raw);

    const routeName = `v1:${c.req.method}:${c.req.routePath}`;
    await this.rateLimits.consume(this.services.mutationRateLimit ?? DEFAULT_USER_RATE_LIMIT, routeName, user.id);

    return this.idempotency.run(c.req.raw, user.id, routeName, async () => {
      await next();
      return c.res;
    });
  };

  /** For public endpoints (sign in): limited per IP. */
  forPublic(spec: IpRateLimitSpec): MiddlewareHandler<V1Env> {
    return async (c, next) => {
      await this.rateLimits.consume(spec, `v1:${c.req.method}:${c.req.routePath}`, this.services.clientIp(c.req.raw));
      return next();
    };
  }
}
