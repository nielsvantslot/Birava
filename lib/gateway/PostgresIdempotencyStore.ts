import { Prisma, type PrismaClient } from "@prisma/client";
import type { IIdempotencyStore, IdempotencyBegin, IdempotencyScope, StoredResponse } from "./IIdempotencyStore";

/**
 * Backed by the IdempotencyKey table, for the same reason the rate limiter is
 * Postgres-backed: no new hosting, and a unique index gives the atomic
 * "first one wins" this needs. A row exists from `begin` (status null) until
 * `complete` fills it in, and is pruned a day after it was written.
 */
export class PostgresIdempotencyStore implements IIdempotencyStore {
  /** A started row older than this belonged to a request that died without finishing, so its key may be reused. */
  private static readonly STALE_IN_PROGRESS_MS = 5 * 60 * 1000;
  /** How long a finished response can be replayed. */
  static readonly RETENTION_MS = 24 * 60 * 60 * 1000;

  constructor(private readonly db: PrismaClient) {}

  async begin(scope: IdempotencyScope, requestHash: string): Promise<IdempotencyBegin> {
    try {
      const row = await this.db.idempotencyKey.create({ data: { ...scope, requestHash }, select: { id: true } });
      return { state: "started", claim: row.id };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }

    const existing = await this.db.idempotencyKey.findUnique({
      where: { userId_key_route: scope },
    });
    // Pruned between the failed insert and this read: nothing to replay, start over.
    if (!existing) return this.begin(scope, requestHash);

    if (existing.requestHash !== requestHash) return { state: "conflict", reason: "different-request" };

    if (existing.status === null) {
      const age = Date.now() - existing.createdAt.getTime();
      if (age < PostgresIdempotencyStore.STALE_IN_PROGRESS_MS) return { state: "conflict", reason: "in-progress" };
      // The first attempt crashed before finishing; take the key over.
      await this.db.idempotencyKey.deleteMany({ where: { id: existing.id, status: null } });
      return this.begin(scope, requestHash);
    }

    return {
      state: "replay",
      response: { status: existing.status, contentType: existing.contentType, body: existing.body ?? "" },
    };
  }

  async complete(claim: string, response: StoredResponse): Promise<void> {
    await this.db.idempotencyKey.updateMany({
      where: { id: claim },
      data: { status: response.status, contentType: response.contentType, body: response.body },
    });
  }

  async abandon(claim: string): Promise<void> {
    await this.db.idempotencyKey.deleteMany({ where: { id: claim, status: null } });
  }

  /** Deletes records past their retention. Returns how many. */
  async pruneExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - PostgresIdempotencyStore.RETENTION_MS);
    const { count } = await this.db.idempotencyKey.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return count;
  }
}
