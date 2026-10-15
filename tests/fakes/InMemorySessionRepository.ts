import type { ISessionRepository, SessionRecord, SessionUserRecord } from "@/modules/identity/domain/ISessionRepository";

/** An in-memory `ISessionRepository` for tests that don't need SQL semantics. Counts reads so cache behaviour can be asserted. */
export class InMemorySessionRepository implements ISessionRepository {
  private readonly rows = new Map<string, SessionRecord>();
  findCalls = 0;

  /** Seeds a session for `user`; returns its token. */
  add(user: Partial<SessionUserRecord> & { id: string }, expiresAt: Date, token = `token-${this.rows.size + 1}`): string {
    this.rows.set(token, {
      expiresAt,
      user: {
        email: `${user.id}@test.birava`,
        username: user.id,
        avatarUrl: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        isDeveloper: false,
        ...user,
      },
    });
    return token;
  }

  async create(session: { userId: string; sessionToken: string; expiresAt: Date }): Promise<void> {
    this.add({ id: session.userId }, session.expiresAt, session.sessionToken);
  }

  async findWithUser(sessionToken: string): Promise<SessionRecord | null> {
    this.findCalls += 1;
    return this.rows.get(sessionToken) ?? null;
  }

  async deleteByToken(sessionToken: string): Promise<void> {
    this.rows.delete(sessionToken);
  }
}
