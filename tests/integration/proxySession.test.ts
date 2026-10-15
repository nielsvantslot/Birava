import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resolveSessionUser } from "@/modules/identity/server/proxy-session";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";

const fixtures = new DrinkEntryFixtureFactory(db);

async function createSession(userId: string, expiresAt = new Date(Date.now() + 86_400_000)) {
  const sessionToken = randomUUID();
  await db.session.create({ data: { userId, sessionToken, expiresAt } });
  return sessionToken;
}

// Storage-level behaviour only: the real select and mapping against Postgres. The cache lives in
// SessionResolver and is covered by its in-memory unit test.
describe("resolveSessionUser", () => {
  it("resolves a valid session token to that session's user", async () => {
    const user = await fixtures.createUser();
    const token = await createSession(user.id);

    const dto = await resolveSessionUser(token);

    expect(dto?.id).toBe(user.id);
    expect(dto?.username).toBe(user.username);
  });

  it("returns null for a token with no matching session", async () => {
    const dto = await resolveSessionUser(randomUUID());
    expect(dto).toBeNull();
  });

  it("returns null for an expired session", async () => {
    const user = await fixtures.createUser();
    const token = await createSession(user.id, new Date(Date.now() - 1000));

    const dto = await resolveSessionUser(token);

    expect(dto).toBeNull();
  });
});
