import type { PrismaClient } from "@prisma/client";
import type { ISessionRepository, SessionRecord } from "@/modules/identity/domain/ISessionRepository";

export class PrismaSessionRepository implements ISessionRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(session: { userId: string; sessionToken: string; expiresAt: Date }): Promise<void> {
    await this.db.session.create({ data: session });
  }

  async findWithUser(sessionToken: string): Promise<SessionRecord | null> {
    return this.db.session.findUnique({
      where: { sessionToken },
      select: {
        expiresAt: true,
        user: { select: { id: true, email: true, username: true, avatarUrl: true, createdAt: true, isDeveloper: true } },
      },
    });
  }

  async deleteByToken(sessionToken: string): Promise<void> {
    await this.db.session.deleteMany({ where: { sessionToken } });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.db.session.deleteMany({ where: { userId } });
  }
}
