import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ILogger } from "@/lib/logging/ILogger";
import type { IRateLimiter } from "@/lib/rateLimit/IRateLimiter";
import { ApiError } from "./ApiError";
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

function setup(options: { user?: User | null; cronOk?: boolean } = {}) {
  const logger = new FakeLogger();
  const limiter = new CountingLimiter();
  const user = options.user === undefined ? { id: "u1" } : options.user;
  const services: GatewayServices<User> = {
    authenticator: { authenticate: async () => user },
    cronVerifier: { verify: () => options.cronOk ?? true },
    rateLimiter: limiter,
    logger,
    clientIp: () => "1.2.3.4",
    clientIpFromHeaders: async () => "1.2.3.4",
  };
  return { gateway: new Gateway(services), logger, limiter };
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

  it("passes the signed-in user, route params and parsed input to the handler", async () => {
    const { gateway } = setup();
    const route = gateway.route.authed<{ params: Promise<{ id: string }> }, { body: z.ZodObject<{ n: z.ZodNumber }> }>(
      { name: "t", body: z.object({ n: z.number() }) },
      async ({ user, params, input }) => ({ who: user.id, id: params.id, n: input.body.n })
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
