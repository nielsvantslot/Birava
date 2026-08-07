import { RateLimitResult } from "@/lib/rateLimit/Models";

/**
 * Fixed-window request limiter. `key` is already fully scoped by the caller
 * (e.g. "login:1.2.3.4", "join-crew:<userId>") — this interface has no
 * opinion on identity, only on counting attempts against a window.
 */
export interface IRateLimiter {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}
