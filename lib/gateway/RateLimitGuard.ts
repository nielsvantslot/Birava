import type { ILogger } from "@/lib/logging/ILogger";
import type { IRateLimiter } from "@/lib/rateLimit/IRateLimiter";
import { ApiError } from "./ApiError";
import type { RateLimitSpec } from "./Models";

/** Every authenticated mutation is limited per user unless a route says otherwise; generous enough for an offline queue flushing. */
export const DEFAULT_USER_RATE_LIMIT: RateLimitSpec = {
  bucket: "default",
  limit: 300,
  windowMs: 60 * 1000,
  scope: "user",
  message: "Too many requests. Try again shortly.",
};

export class RateLimitGuard {
  constructor(
    private readonly limiter: IRateLimiter,
    private readonly logger: ILogger
  ) {}

  /**
   * Counts one attempt against `spec`, throwing RATE_LIMITED (with Retry-After) when over. `subject` is the IP or user id.
   * The default limit is a safety net, not a security control, so when the limiter itself is down it lets the request
   * through (and logs) rather than failing every mutation. An endpoint's own explicit limit (login, signup) fails closed.
   */
  async consume(spec: RateLimitSpec, name: string, subject: string): Promise<void> {
    const key = `${spec.bucket === "default" ? `${name}` : spec.bucket}:${subject}`;
    let result;
    try {
      result = await this.limiter.consume(key, spec.limit, spec.windowMs);
    } catch (error) {
      if (spec !== DEFAULT_USER_RATE_LIMIT) throw error;
      this.logger.warn("rate limiter unavailable, allowing request", { key, error });
      return;
    }
    if (!result.allowed) {
      throw ApiError.rateLimited(spec.message ?? "Too many requests. Try again shortly.", Math.ceil(result.retryAfterMs / 1000));
    }
  }
}
