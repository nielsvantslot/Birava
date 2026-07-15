import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { hashPassword } from "@/lib/auth/password";
import type {
  DrinkEntryFixture,
  DrinkEntryFixtureInput,
  IDrinkEntryFixtureFactory,
  UserFixture,
  UserFixtureInput,
} from "./IDrinkEntryFixtureFactory";

export class DrinkEntryFixtureFactory implements IDrinkEntryFixtureFactory {
  private userSequence = 0;
  private entrySequence = 0;

  constructor(private readonly db: PrismaClient) {}

  async createUser(overrides: UserFixtureInput = {}): Promise<UserFixture> {
    this.userSequence += 1;
    const suffix = this.userSequence;
    const passwordHash = await hashPassword(overrides.password ?? "Test123!");

    return this.db.user.create({
      data: {
        username: overrides.username ?? `fixture_user_${suffix}`,
        email: overrides.email ?? `fixture_user_${suffix}@test.birava`,
        passwordHash,
      },
      select: { id: true, username: true, email: true, avatarUrl: true },
    });
  }

  async createDrinkEntry(userId: string, overrides: DrinkEntryFixtureInput = {}): Promise<DrinkEntryFixture> {
    this.entrySequence += 1;
    const createdAt = overrides.createdAt ?? new Date();

    // DrinkEntry.sessionId is required. Default to a fresh standalone
    // session per entry; pass sessionId to model several check-ins sharing
    // one session instead.
    let sessionId = overrides.sessionId;
    if (!sessionId) {
      sessionId = randomUUID();
      await this.db.drinkSession.create({
        data: { id: sessionId, userId, startedAt: createdAt, endedAt: createdAt },
      });
    }

    return this.db.drinkEntry.create({
      data: {
        userId,
        sessionId,
        drinkName: overrides.drinkName ?? `Fixture Drink ${this.entrySequence}`,
        drinkType: overrides.drinkType ?? "Beer",
        venue: overrides.venue ?? null,
        lat: overrides.lat ?? null,
        lng: overrides.lng ?? null,
        notes: overrides.notes ?? null,
        photoUrl: overrides.photoUrl ?? null,
        photoLqip: overrides.photoLqip ?? null,
        createdAt,
      },
      select: { id: true, createdAt: true },
    });
  }
}
