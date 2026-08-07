import { db } from "@/lib/db";
import { IRateLimiter } from "@/lib/rateLimit/IRateLimiter";
import { PostgresRateLimiter } from "@/lib/rateLimit/PostgresRateLimiter";

export class RateLimiterFactory {
  private static instance: IRateLimiter | undefined;

  static create(): IRateLimiter {
    if (!this.instance) {
      this.instance = new PostgresRateLimiter(db);
    }
    return this.instance;
  }
}
