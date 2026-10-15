import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { Gateway } from "@/lib/gateway/Gateway";
import { PostgresIdempotencyStore } from "@/lib/gateway/PostgresIdempotencyStore";
import { LoggerFactory } from "@/lib/logging/LoggerFactory";
import { RateLimiterFactory } from "@/lib/rateLimit/RateLimiterFactory";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";

const fixtures = new DrinkEntryFixtureFactory(db);
const store = new PostgresIdempotencyStore(db);
const noParams = { params: Promise.resolve({}) };

/** A gateway wired like production (real Postgres store and limiter) but signed in as whoever the test says. */
function gatewayFor(userId: string) {
  return new Gateway<{ id: string }>({
    authenticator: { authenticate: async () => ({ id: userId }) },
    cronVerifier: { verify: () => true },
    rateLimiter: RateLimiterFactory.create(),
    idempotency: store,
    logger: LoggerFactory.create("test"),
    clientIp: () => "1.2.3.4",
    clientIpFromHeaders: async () => "1.2.3.4",
  });
}

function post(body: unknown, key?: string) {
  return new Request("http://app.test/api/things", {
    method: "POST",
    headers: { "content-type": "application/json", host: "app.test", ...(key ? { "idempotency-key": key } : {}) },
    body: JSON.stringify(body),
  });
}

describe("Idempotency-Key against Postgres", () => {
  it("has no second effect when the same request is repeated with the same key", async () => {
    const user = await fixtures.createUser();
    let effects = 0;
    const route = gatewayFor(user.id).route.authed({ name: "things.create" }, async () => ({ effect: ++effects }));

    const first = await route(post({ a: 1 }, "key-aaaaaaaa"), noParams);
    const second = await route(post({ a: 1 }, "key-aaaaaaaa"), noParams);

    expect(await first.json()).toEqual({ effect: 1 });
    expect(await second.json()).toEqual({ effect: 1 });
    expect(second.headers.get("Idempotent-Replay")).toBe("true");
    expect(effects).toBe(1);
    expect(await db.idempotencyKey.count()).toBe(1);
  });

  it("runs once even when two identical requests arrive at the same moment", async () => {
    const user = await fixtures.createUser();
    let effects = 0;
    const route = gatewayFor(user.id).route.authed({ name: "things.create" }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { effect: ++effects };
    });

    const [a, b] = await Promise.all([route(post({}, "key-concurrent"), noParams), route(post({}, "key-concurrent"), noParams)]);

    expect(effects).toBe(1);
    // One got the real answer, the other was told the first is still running.
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  it("scopes a key to its user and to its endpoint", async () => {
    const alice = await fixtures.createUser();
    const bob = await fixtures.createUser();
    let effects = 0;
    const handler = async () => ({ effect: ++effects });

    await gatewayFor(alice.id).route.authed({ name: "things.create" }, handler)(post({}, "key-shared01"), noParams);
    await gatewayFor(bob.id).route.authed({ name: "things.create" }, handler)(post({}, "key-shared01"), noParams);
    await gatewayFor(alice.id).route.authed({ name: "things.other" }, handler)(post({}, "key-shared01"), noParams);

    expect(effects).toBe(3);
  });

  it("refuses a key reused for a different request and remembers nothing about a failed one", async () => {
    const user = await fixtures.createUser();
    let attempts = 0;
    const route = gatewayFor(user.id).route.authed({ name: "things.create" }, async () => {
      if (++attempts === 1) throw new Error("boom");
      return { ok: true };
    });

    expect((await route(post({ a: 1 }, "key-retry-001"), noParams)).status).toBe(500);
    expect(await db.idempotencyKey.count()).toBe(0);

    expect((await route(post({ a: 1 }, "key-retry-001"), noParams)).status).toBe(200);
    expect((await route(post({ a: 2 }, "key-retry-001"), noParams)).status).toBe(409);
  });

  it("takes over a key whose first attempt died long ago, and prunes expired records", async () => {
    const user = await fixtures.createUser();
    const route = gatewayFor(user.id).route.authed({ name: "things.create" }, async () => ({ ok: true }));
    // A "started" record from a request that crashed ten minutes ago, with the same fingerprint the new request will have.
    await route(post({}, "key-crashed-01"), noParams);
    await db.idempotencyKey.updateMany({ data: { status: null, contentType: null, body: null, createdAt: new Date(Date.now() - 10 * 60 * 1000) } });

    const retried = await route(post({}, "key-crashed-01"), noParams);
    expect(retried.status).toBe(200);
    expect(retried.headers.get("Idempotent-Replay")).toBeNull();

    await db.idempotencyKey.updateMany({ data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } });
    expect(await store.pruneExpired()).toBe(1);
    expect(await db.idempotencyKey.count()).toBe(0);
  });

  it("deletes a user's records along with the user", async () => {
    const user = await fixtures.createUser();
    await gatewayFor(user.id).route.authed({ name: "things.create" }, async () => ({ ok: true }))(post({}, "key-erasure-1"), noParams);

    await db.user.delete({ where: { id: user.id } });

    expect(await db.idempotencyKey.count()).toBe(0);
  });
});
