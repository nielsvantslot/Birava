import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ILogger } from "@/lib/logging/ILogger";
import type { IRateLimiter } from "@/lib/rateLimit/IRateLimiter";
import { ApiError } from "./ApiError";
import type { IIdempotencyStore, IdempotencyBegin, IdempotencyScope, StoredResponse } from "./IIdempotencyStore";
import { Gateway } from "./Gateway";
import type { GatewayServices } from "./GatewayServices";

type User = { id: string };

class FakeLogger implements ILogger {
  readonly errors: { message: string; fields?: Record<string, unknown> }[] = [];
  debug() {}
  info() {}
  warn() {}
  error(message: string, fields?: Record<string, unknown>) {
    this.errors.push({ message, fields });
  }
  child() {
    return this;
  }
}

/** Allows `limit` hits per key, then refuses with a 30s retry hint. */
class CountingLimiter implements IRateLimiter {
  readonly keys: string[] = [];
  private readonly counts = new Map<string, number>();
  async consume(key: string, limit: number) {
    this.keys.push(key);
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return { allowed: next <= limit, remaining: Math.max(0, limit - next), retryAfterMs: 30_000 };
  }
}

class MemoryIdempotencyStore implements IIdempotencyStore {
  readonly rows = new Map<string, { hash: string; response: StoredResponse | null }>();
  private id = (s: IdempotencyScope) => `${s.userId}|${s.key}|${s.route}`;
  async begin(scope: IdempotencyScope, hash: string): Promise<IdempotencyBegin> {
    const existing = this.rows.get(this.id(scope));
    if (!existing) {
      this.rows.set(this.id(scope), { hash, response: null });
      return { state: "started", claim: this.id(scope) };
    }
    if (existing.hash !== hash) return { state: "conflict", reason: "different-request" };
    if (!existing.response) return { state: "conflict", reason: "in-progress" };
    return { state: "replay", response: existing.response };
  }
  async complete(claim: string, response: StoredResponse) {
    const row = this.rows.get(claim);
    if (row) row.response = response;
  }
  async abandon(claim: string) {
    this.rows.delete(claim);
  }
}

class BrokenLimiter implements IRateLimiter {
  async consume(): Promise<never> {
    throw new Error("database unavailable");
  }
}

function setup(options: { user?: User | null; cronOk?: boolean; brokenLimiter?: boolean } = {}) {
  const logger = new FakeLogger();
  const limiter: IRateLimiter = options.brokenLimiter ? new BrokenLimiter() : new CountingLimiter();
  const user = options.user === undefined ? { id: "u1" } : options.user;
  const services: GatewayServices<User> = {
    authenticator: { authenticate: async () => user },
    cronVerifier: { verify: () => options.cronOk ?? true },
    rateLimiter: limiter,
    idempotency: new MemoryIdempotencyStore(),
    logger,
    clientIp: () => "1.2.3.4",
    clientIpFromHeaders: async () => "1.2.3.4",
  };
  return { gateway: new Gateway(services), logger, limiter: limiter as CountingLimiter };
}

const ctx = { params: Promise.resolve({}) };

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://app.test/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", host: "app.test", ...headers },
    body: JSON.stringify(body),
  });
}

async function errorOf(response: Response) {
  return (await response.json()) as { error: { code: string; message: string; fields?: Record<string, string[]> } };
}

describe("route gateway: authentication", () => {
  it("returns the envelope with UNAUTHENTICATED when there is no session", async () => {
    const { gateway } = setup({ user: null });
    const handler = vi.fn();
    const route = gateway.route.authed({ name: "t" }, handler);

    const response = await route(post({}), ctx);

    expect(response.status).toBe(401);
    expect((await errorOf(response)).error.code).toBe("UNAUTHENTICATED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes the signed-in user and the validated params and body to the handler", async () => {
    const { gateway } = setup();
    const route = gateway.route.authed(
      { name: "t", params: z.object({ id: z.string() }), body: z.object({ n: z.number() }) },
      async ({ user, input }) => ({ who: user.id, id: input.params.id, n: input.body.n })
    );

    const response = await route(post({ n: 3 }), { params: Promise.resolve({ id: "abc" }) });

    expect(await response.json()).toEqual({ who: "u1", id: "abc", n: 3 });
  });

  it("lets cron routes in only with the cron secret", async () => {
    const denied = setup({ cronOk: false }).gateway.route.cron({ name: "c" }, async () => ({ ok: true }));
    expect((await denied(new Request("http://app.test/api/cron/x"))).status).toBe(401);

    const allowed = setup({ cronOk: true }).gateway.route.cron({ name: "c" }, async () => ({ ok: true }));
    const response = await allowed(new Request("http://app.test/api/cron/x"));
    expect(await response.json()).toEqual({ ok: true });
  });
});

describe("route gateway: validation", () => {
  it("rejects a malformed body with field-level errors before the handler runs", async () => {
    const { gateway } = setup();
    const handler = vi.fn();
    const route = gateway.route.authed({ name: "t", body: z.object({ email: z.email(), age: z.number() }) }, handler);

    const response = await route(post({ email: "nope" }), ctx);
    const body = await errorOf(response);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(body.error.fields ?? {}).sort()).toEqual(["age", "email"]);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    const { gateway } = setup();
    const route = gateway.route.authed({ name: "t", body: z.object({}) }, async () => ({}));
    const request = new Request("http://app.test/api/x", { method: "POST", headers: { host: "app.test" }, body: "{oops" });

    expect((await errorOf(await route(request, ctx))).error.code).toBe("VALIDATION_FAILED");
  });

  it("validates the query string", async () => {
    const { gateway } = setup();
    const route = gateway.route.authed({ name: "t", query: z.object({ w: z.coerce.number() }) }, async ({ input }) => ({ w: input.query.w }));

    const response = await route(new Request("http://app.test/api/x?w=640"), ctx);

    expect(await response.json()).toEqual({ w: 640 });
  });
});

describe("route gateway: rate limiting", () => {
  it("limits authenticated mutations per user by default and answers 429 with Retry-After", async () => {
    const { gateway, limiter } = setup();
    const route = gateway.route.authed({ name: "t", rateLimit: { bucket: "t", limit: 1, windowMs: 1000, scope: "user" } }, async () => ({}));

    expect((await route(post({}), ctx)).status).toBe(200);
    const limited = await route(post({}), ctx);

    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("30");
    expect((await errorOf(limited)).error.code).toBe("RATE_LIMITED");
    expect(limiter.keys[0]).toBe("t:u1");
  });

  it("does not count reads by default, and honours rateLimit: false", async () => {
    const { gateway, limiter } = setup();
    const route = gateway.route.authed({ name: "t" }, async () => ({}));
    await route(new Request("http://app.test/api/x"), ctx);
    expect(limiter.keys).toHaveLength(0);

    const writes = gateway.route.authed({ name: "w", rateLimit: false }, async () => ({}));
    await writes(post({}), ctx);
    expect(limiter.keys).toHaveLength(0);
  });

  it("limits a public route by IP using its own bucket name", async () => {
    const { gateway, limiter } = setup();
    const route = gateway.route.public(
      { name: "login", rateLimit: { bucket: "login", limit: 1, windowMs: 1000, scope: "ip", message: "Slow down." } },
      async () => ({ ok: true })
    );

    await route(post({}), ctx);
    const limited = await route(post({}), ctx);

    expect(limiter.keys).toEqual(["login:1.2.3.4", "login:1.2.3.4"]);
    expect((await errorOf(limited)).error.message).toBe("Slow down.");
  });
});

describe("route gateway: a broken rate limiter", () => {
  it("lets a request through on the default limit, because that limit is only a safety net", async () => {
    const { gateway } = setup({ brokenLimiter: true });
    const route = gateway.route.authed({ name: "t" }, async () => ({ ok: true }));

    expect((await route(post({}), ctx)).status).toBe(200);
  });

  it("lets a best-effort endpoint opt in to failing open", async () => {
    const { gateway } = setup({ brokenLimiter: true });
    const route = gateway.route.public(
      { name: "beacon", rateLimit: { bucket: "beacon", limit: 1, windowMs: 1000, scope: "ip", failOpen: true } },
      async () => ({ ok: true })
    );

    expect((await route(post({}), ctx)).status).toBe(200);
  });

  it("fails closed on an endpoint's own explicit limit", async () => {
    const { gateway, logger } = setup({ brokenLimiter: true });
    const route = gateway.route.public(
      { name: "login", rateLimit: { bucket: "login", limit: 1, windowMs: 1000, scope: "ip" } },
      async () => ({ ok: true })
    );

    expect((await route(post({}), ctx)).status).toBe(500);
    expect(logger.errors).toHaveLength(1);
  });
});

describe("route gateway: origin check", () => {
  it("rejects a cross-origin mutation even with a valid session", async () => {
    const { gateway } = setup();
    const handler = vi.fn();
    const route = gateway.route.authed({ name: "t" }, handler);

    const response = await route(post({}, { origin: "https://evil.example" }), ctx);

    expect(response.status).toBe(403);
    expect((await errorOf(response)).error.code).toBe("ORIGIN_MISMATCH");
    expect(handler).not.toHaveBeenCalled();
  });

  it("accepts the app's own origin, including behind a proxy's forwarded host", async () => {
    const { gateway } = setup();
    const route = gateway.route.authed({ name: "t" }, async () => ({ ok: true }));

    expect((await route(post({}, { origin: "http://app.test" }), ctx)).status).toBe(200);
    expect((await route(post({}, { origin: "https://birava.app", "x-forwarded-host": "birava.app" }), ctx)).status).toBe(200);
  });

  it("rejects an explicit cross-site fetch that carries no Origin, and allows reads from anywhere", async () => {
    const { gateway } = setup();
    const route = gateway.route.authed({ name: "t" }, async () => ({ ok: true }));

    expect((await route(post({}, { "sec-fetch-site": "cross-site" }), ctx)).status).toBe(403);
    const read = new Request("http://app.test/api/x", { headers: { origin: "https://evil.example" } });
    expect((await route(read, ctx)).status).toBe(200);
  });
});

describe("route gateway: results and errors", () => {
  it("passes a Response through untouched and turns null into 204", async () => {
    const { gateway } = setup();
    const raw = gateway.route.authed({ name: "t" }, async () => new Response("bytes", { status: 206 }));
    const empty = gateway.route.authed({ name: "t" }, async () => null);

    expect((await raw(new Request("http://app.test/x"), ctx)).status).toBe(206);
    expect((await empty(new Request("http://app.test/x"), ctx)).status).toBe(204);
  });

  it("maps a thrown ApiError to its code and status", async () => {
    const { gateway } = setup();
    const route = gateway.route.authed({ name: "t" }, async () => {
      throw ApiError.notFound("No such session");
    });

    const response = await route(new Request("http://app.test/x"), ctx);

    expect(response.status).toBe(404);
    expect(await errorOf(response)).toEqual({ error: { code: "NOT_FOUND", message: "No such session" } });
  });

  it("hides an unexpected error behind INTERNAL and logs it", async () => {
    const { gateway, logger } = setup();
    const route = gateway.route.authed({ name: "boom" }, async () => {
      throw new Error("secret database detail");
    });

    const response = await route(new Request("http://app.test/x"), ctx);
    const body = await errorOf(response);

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(logger.errors).toHaveLength(1);
  });
});

describe("Next control flow", () => {
  const redirectError = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });

  it("is rethrown untouched by a route and by an action, and not logged as a failure", async () => {
    const { gateway, logger } = setup();
    const route = gateway.route.authed({ name: "r" }, async () => {
      throw redirectError;
    });
    const action = gateway.action.authed({ name: "a" }, async () => {
      throw redirectError;
    });

    await expect(route(new Request("http://app.test/x"), ctx)).rejects.toBe(redirectError);
    await expect(action()).rejects.toBe(redirectError);
    expect(logger.errors).toHaveLength(0);
  });
});

describe("route gateway: invalid input messages", () => {
  it("uses the route's own message for a bad body or form", async () => {
    const { gateway } = setup();
    const route = gateway.route.authed({ name: "t", body: z.object({ url: z.string() }), invalidMessage: "Invalid upload." }, async () => ({}));

    expect((await errorOf(await route(post({}), ctx))).error.message).toBe("Invalid upload.");
  });
});

describe("route gateway: Idempotency-Key", () => {
  const KEY = "retry-key-0001";

  it("runs a mutation once and replays the first response for a repeat with the same key", async () => {
    const { gateway } = setup();
    let runs = 0;
    const route = gateway.route.authed({ name: "t", body: z.object({ n: z.number() }) }, async () => ({ run: ++runs }));

    const first = await route(post({ n: 1 }, { "idempotency-key": KEY }), ctx);
    const second = await route(post({ n: 1 }, { "idempotency-key": KEY }), ctx);

    expect(await first.json()).toEqual({ run: 1 });
    expect(await second.json()).toEqual({ run: 1 });
    expect(second.headers.get("Idempotent-Replay")).toBe("true");
    expect(first.headers.get("Idempotent-Replay")).toBeNull();
    expect(runs).toBe(1);
  });

  it("runs again for a different key, and always when there is no key", async () => {
    const { gateway } = setup();
    let runs = 0;
    const route = gateway.route.authed({ name: "t" }, async () => ({ run: ++runs }));

    await route(post({}, { "idempotency-key": KEY }), ctx);
    await route(post({}, { "idempotency-key": "another-key-02" }), ctx);
    await route(post({}), ctx);
    await route(post({}), ctx);

    expect(runs).toBe(4);
  });

  it("answers 409 when a key is reused for a different request body", async () => {
    const { gateway } = setup();
    const route = gateway.route.authed({ name: "t" }, async () => ({ ok: true }));

    await route(post({ a: 1 }, { "idempotency-key": KEY }), ctx);
    const reused = await route(post({ a: 2 }, { "idempotency-key": KEY }), ctx);

    expect(reused.status).toBe(409);
    expect((await errorOf(reused)).error.code).toBe("CONFLICT");
  });

  it("does not keep a failed request, so the same key can be retried", async () => {
    const { gateway } = setup();
    let attempt = 0;
    const route = gateway.route.authed({ name: "t" }, async () => {
      if (++attempt === 1) throw ApiError.notFound("not yet");
      return { ok: true };
    });

    expect((await route(post({}, { "idempotency-key": KEY }), ctx)).status).toBe(404);
    const retry = await route(post({}, { "idempotency-key": KEY }), ctx);

    expect(retry.status).toBe(200);
    expect(attempt).toBe(2);
  });

  it("replays an empty 204, and refuses a malformed key", async () => {
    const { gateway } = setup();
    const route = gateway.route.authed({ name: "t" }, async () => null);

    await route(post({}, { "idempotency-key": KEY }), ctx);
    const replay = await route(post({}, { "idempotency-key": KEY }), ctx);
    expect(replay.status).toBe(204);
    expect(replay.headers.get("Idempotent-Replay")).toBe("true");

    const bad = await route(post({}, { "idempotency-key": "x" }), ctx);
    expect(bad.status).toBe(400);
  });

  it("ignores the header on a read", async () => {
    const { gateway } = setup();
    let runs = 0;
    const route = gateway.route.authed({ name: "t" }, async () => ({ run: ++runs }));
    const read = () => new Request("http://app.test/api/x", { headers: { "idempotency-key": KEY } });

    await route(read(), ctx);
    await route(read(), ctx);

    expect(runs).toBe(2);
  });
});

describe("action gateway", () => {
  it("returns an UNAUTHENTICATED failure instead of running the handler", async () => {
    const { gateway } = setup({ user: null });
    const handler = vi.fn();
    const action = gateway.action.authed({ name: "a" }, handler);

    expect(await action()).toEqual({ error: "Not authenticated", code: "UNAUTHENTICATED" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("validates the argument and returns field errors", async () => {
    const { gateway } = setup();
    const action = gateway.action.authed({ name: "a", input: z.object({ id: z.string().min(1) }) }, async () => "done");

    const result = await action({ id: "" });

    expect(result).toMatchObject({ code: "VALIDATION_FAILED", fields: { id: expect.any(Array) } });
  });

  it("runs the handler with the user and parsed input, and returns its result", async () => {
    const { gateway } = setup();
    const action = gateway.action.authed({ name: "a", input: z.object({ n: z.number() }) }, async ({ user, input }) => ({
      id: user.id,
      double: input.n * 2,
    }));

    expect(await action({ n: 4 })).toEqual({ id: "u1", double: 8 });
  });

  it("returns an ApiError as a failure, and rethrows (after logging) anything unexpected", async () => {
    const { gateway, logger } = setup();
    const expected = gateway.action.authed({ name: "a" }, async () => {
      throw ApiError.conflict("Already a member");
    });
    const unexpected = gateway.action.authed({ name: "b" }, async () => {
      throw new Error("db down");
    });

    expect(await expected()).toEqual({ error: "Already a member", code: "CONFLICT" });
    await expect(unexpected()).rejects.toThrow("db down");
    expect(logger.errors[0]?.fields).toMatchObject({ action: "b" });
  });

  it("rate limits per user by default", async () => {
    const { gateway } = setup();
    const action = gateway.action.authed({ name: "a", rateLimit: { bucket: "a", limit: 1, windowMs: 1000, scope: "user" } }, async () => "ok");

    expect(await action()).toBe("ok");
    expect(await action()).toMatchObject({ code: "RATE_LIMITED" });
  });
});
