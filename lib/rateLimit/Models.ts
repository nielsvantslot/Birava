export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};
