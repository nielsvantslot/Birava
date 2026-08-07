import { PrismaClient } from "@prisma/client";
import { IRateLimiter } from "@/lib/rateLimit/IRateLimiter";
import { RateLimitResult } from "@/lib/rateLimit/Models";

type RateLimitBucketRow = { count: number; windowStart: Date };

/**
 * Backed by the RateLimitBucket table rather than Redis/Upstash — this app
 * stays on Neon/Vercel free tiers (no new hosting spend), and Postgres is
 * already provisioned. The upsert is a single atomic INSERT ... ON CONFLICT:
 * concurrent requests against the same key serialize on the row instead of
 * racing on a read-then-write increment.
 */
export class PostgresRateLimiter implements IRateLimiter {
  constructor(private readonly db: PrismaClient) {}

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const rows = await this.db.$queryRaw<RateLimitBucketRow[]>`
      INSERT INTO "RateLimitBucket" (key, count, "windowStart")
      VALUES (${key}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN "RateLimitBucket"."windowStart" <= now() - (interval '1 millisecond' * ${windowMs}::float)
          THEN 1
          ELSE "RateLimitBucket".count + 1
        END,
        "windowStart" = CASE
          WHEN "RateLimitBucket"."windowStart" <= now() - (interval '1 millisecond' * ${windowMs}::float)
          THEN now()
          ELSE "RateLimitBucket"."windowStart"
        END
      RETURNING count, "windowStart"
    `;

    const row = rows[0];
    const allowed = row.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - row.count),
      retryAfterMs: allowed ? 0 : Math.max(0, windowMs - (Date.now() - row.windowStart.getTime())),
    };
  }
}
