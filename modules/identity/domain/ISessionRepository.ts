/** The user fields a session needs to say who is signed in. */
export type SessionUserRecord = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  createdAt: Date;
  isDeveloper: boolean;
};

export type SessionRecord = {
  expiresAt: Date;
  user: SessionUserRecord;
};

/** Where login sessions are stored. The Prisma implementation is in infrastructure/; tests use an in-memory one. */
export interface ISessionRepository {
  create(session: { userId: string; sessionToken: string; expiresAt: Date }): Promise<void>;
  /** The session for a token with its user, or null when there is none. Expiry is the caller's decision. */
  findWithUser(sessionToken: string): Promise<SessionRecord | null>;
  deleteByToken(sessionToken: string): Promise<void>;
}
