import { db } from "@/lib/db";

/**
 * Deletes stale RateLimitBucket rows so the table stays bounded on Neon's
 * free-tier storage. A row past its window has no further use —
 * PostgresRateLimiter resets an expired window on its next hit regardless of
 * whether the old row was ever pruned — so anything past the retention
 * cutoff is safe to drop.
 */
export class RateLimitBucketPruner {
  private static readonly RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

  static async prune(): Promise<number> {
    const cutoff = new Date(Date.now() - this.RETENTION_MS);
    const { count } = await db.rateLimitBucket.deleteMany({
      where: { windowStart: { lt: cutoff } },
    });
    return count;
  }
}
