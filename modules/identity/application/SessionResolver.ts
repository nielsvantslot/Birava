import type { SessionUserDTO } from "@/lib/dtos";
import { SessionUserMapper } from "@/lib/mappers";
import type { ISessionRepository } from "@/modules/identity/domain/ISessionRepository";

type CacheEntry = { dto: SessionUserDTO | null; cachedAt: number };

/**
 * Turns a session token into the signed-in user, for middleware.
 *
 * Every matched navigation pays this lookup before anything else can render,
 * so it is the single highest-frequency query in the app. A short in-memory
 * TTL cache, keyed by token, turns rapid-fire navigation (clicking through
 * several tabs in a few seconds) into cache hits instead of a Postgres round
 * trip each time. Best-effort only: a serverless instance can always come up
 * cold with an empty cache, which just falls through to the database, so this
 * can only help, never regress, correctness.
 *
 * Trade-off worth knowing: a logout doesn't proactively evict this cache, so
 * a captured token could still be treated as valid for up to `ttlMs` after
 * the real session row is deleted elsewhere. Kept deliberately short (a few
 * seconds) so that window stays negligible relative to the token itself being
 * httpOnly and not trivially exfiltrated.
 */
export class SessionResolver {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly sessions: ISessionRepository,
    private readonly now: () => number = Date.now,
    private readonly ttlMs = 5_000,
    private readonly maxEntries = 5_000
  ) {}

  async resolve(token: string): Promise<SessionUserDTO | null> {
    const cached = this.cached(token);
    if (cached !== undefined) return cached;

    const session = await this.sessions.findWithUser(token);
    const isValid = !!session && session.expiresAt.getTime() > this.now();
    const dto = isValid ? SessionUserMapper.toDTO(session.user) : null;
    this.remember(token, dto);
    return dto;
  }

  private cached(token: string): SessionUserDTO | null | undefined {
    const entry = this.cache.get(token);
    if (!entry) return undefined;
    if (this.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(token);
      return undefined;
    }
    return entry.dto;
  }

  private remember(token: string, dto: SessionUserDTO | null): void {
    if (this.cache.size >= this.maxEntries) {
      // Cheap unbounded-growth guard, not true LRU: Map iteration order is
      // insertion order, so this evicts the oldest entry.
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }
    this.cache.set(token, { dto, cachedAt: this.now() });
  }
}
