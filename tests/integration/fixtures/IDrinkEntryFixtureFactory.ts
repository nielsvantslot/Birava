export type UserFixtureInput = {
  username?: string;
  email?: string;
  password?: string;
};

export type UserFixture = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
};

export type DrinkEntryFixtureInput = {
  drinkName?: string | null;
  drinkType?: string;
  venue?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
  photoUrl?: string | null;
  photoLqip?: string | null;
  createdAt?: Date;
};

export type DrinkEntryFixture = {
  id: string;
  createdAt: Date;
};

/** Builds real rows in the isolated test database for integration tests — no mocking, since the tests exist to catch real constraint/query behavior. */
export interface IDrinkEntryFixtureFactory {
  createUser(overrides?: UserFixtureInput): Promise<UserFixture>;
  createDrinkEntry(userId: string, overrides?: DrinkEntryFixtureInput): Promise<DrinkEntryFixture>;
}
