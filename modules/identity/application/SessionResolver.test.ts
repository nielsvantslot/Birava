import { describe, expect, it } from "vitest";
import { InMemorySessionRepository } from "@/tests/fakes/InMemorySessionRepository";
import { SessionResolver } from "./SessionResolver";

const T0 = Date.parse("2026-10-15T12:00:00.000Z");
const IN_A_DAY = new Date(T0 + 86_400_000);

function setup() {
  const sessions = new InMemorySessionRepository();
  let now = T0;
  const resolver = new SessionResolver(sessions, () => now, 5_000, 3);
  return { sessions, resolver, advance: (ms: number) => void (now += ms) };
}

describe("SessionResolver", () => {
  it("resolves a valid token to that session's user", async () => {
    const { sessions, resolver } = setup();
    const token = sessions.add({ id: "u1", username: "niels" }, IN_A_DAY);

    expect(await resolver.resolve(token)).toMatchObject({ id: "u1", username: "niels", createdAt: "2026-01-01T00:00:00.000Z" });
  });

  it("resolves an unknown token and an expired session to null", async () => {
    const { sessions, resolver } = setup();
    const expired = sessions.add({ id: "u1" }, new Date(T0 - 1000));

    expect(await resolver.resolve("nope")).toBeNull();
    expect(await resolver.resolve(expired)).toBeNull();
  });

  it("serves a repeat lookup from memory within the TTL, even if the session row is deleted meanwhile", async () => {
    const { sessions, resolver, advance } = setup();
    const token = sessions.add({ id: "u1" }, IN_A_DAY);

    await resolver.resolve(token);
    await sessions.deleteByToken(token);
    advance(4_000);

    expect((await resolver.resolve(token))?.id).toBe("u1");
    expect(sessions.findCalls).toBe(1);
  });

  it("goes back to storage once the TTL has passed, and notices the deleted session", async () => {
    const { sessions, resolver, advance } = setup();
    const token = sessions.add({ id: "u1" }, IN_A_DAY);

    await resolver.resolve(token);
    await sessions.deleteByToken(token);
    advance(5_001);

    expect(await resolver.resolve(token)).toBeNull();
    expect(sessions.findCalls).toBe(2);
  });

  it("caches a rejection too, so a bad token cannot be used to hammer the database", async () => {
    const { sessions, resolver } = setup();

    await resolver.resolve("nope");
    await resolver.resolve("nope");

    expect(sessions.findCalls).toBe(1);
  });

  it("evicts the oldest entry once the cache is full", async () => {
    const { sessions, resolver } = setup();
    const tokens = ["a", "b", "c", "d"].map((id) => sessions.add({ id }, IN_A_DAY));

    for (const token of tokens) await resolver.resolve(token); // capacity is 3: "a" is evicted by "d"
    sessions.findCalls = 0;
    await resolver.resolve(tokens[3]!); // still cached
    await resolver.resolve(tokens[0]!); // evicted, so it reads storage again

    expect(sessions.findCalls).toBe(1);
  });
});
