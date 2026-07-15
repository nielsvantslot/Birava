import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resolveSessionUser } from "@/lib/auth/proxy-session";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";

const fixtures = new DrinkEntryFixtureFactory(db);

async function createSession(userId: string, expiresAt = new Date(Date.now() + 86_400_000)) {
  const sessionToken = randomUUID();
  await db.session.create({ data: { userId, sessionToken, expiresAt } });
  return sessionToken;
}

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

  it("caches a resolved result — a session row deleted right after still resolves within the TTL window", async () => {
    const user = await fixtures.createUser();
    const token = await createSession(user.id);

    const first = await resolveSessionUser(token);
    expect(first?.id).toBe(user.id);

    await db.session.delete({ where: { sessionToken: token } });

    const second = await resolveSessionUser(token);
    expect(second?.id).toBe(user.id);
  });
});
