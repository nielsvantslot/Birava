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
  constructor(private readonly limiter: IRateLimiter) {}

  /** Counts one attempt against `spec`, throwing RATE_LIMITED (with Retry-After) when over. `subject` is the IP or user id. */
  async consume(spec: RateLimitSpec, name: string, subject: string): Promise<void> {
    const key = `${spec.bucket === "default" ? `${name}` : spec.bucket}:${subject}`;
    const result = await this.limiter.consume(key, spec.limit, spec.windowMs);
    if (!result.allowed) {
      throw ApiError.rateLimited(spec.message ?? "Too many requests. Try again shortly.", Math.ceil(result.retryAfterMs / 1000));
    }
  }
}
