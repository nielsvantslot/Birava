import type { SessionUserDTO } from "@/lib/dtos";
import type { IIdempotencyStore } from "@/lib/gateway/IIdempotencyStore";
import type { RateLimitSpec } from "@/lib/gateway/Models";
import type { ILogger } from "@/lib/logging/ILogger";
import type { IRateLimiter } from "@/lib/rateLimit/IRateLimiter";

/** What the /api/v1 app needs from the outside world. Production wiring is in V1Mount.ts; tests pass their own (a tiny rate limit, a fixed user). */
export type V1Services = {
  /** The signed-in user for this request (cookie or bearer token), or null. */
  authenticate: () => Promise<SessionUserDTO | null>;
  rateLimiter: IRateLimiter;
  idempotency: IIdempotencyStore;
  logger: ILogger;
  clientIp: (request: Request) => string;
  /** Serve GET /openapi.json. Off in production: the committed docs/api/openapi.v1.json is the reference there. */
  exposeDocument: boolean;
  /** Overrides the default per-user mutation limit (the contract tests lower it to prove 429). */
  mutationRateLimit?: RateLimitSpec;
};

/** What a handler can rely on once the guards have run. */
export type V1Env = { Variables: { user: SessionUserDTO } };
