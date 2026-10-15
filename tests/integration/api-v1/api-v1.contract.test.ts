import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { db } from "@/lib/db";
import { V1_FIXTURES, type FixtureRequest } from "./V1Fixtures";
import { V1TestClient } from "./V1TestClient";
import { V1World } from "./V1World";

/**
 * The phase 4 gate. Every operation the /api/v1 app registers is run through
 * the same scenarios, driven by its own route definition (the document the
 * clients get): valid input, invalid input, unauthenticated, rate limited and
 * idempotent replay. An operation without a fixture fails this file.
 */

const client = new V1TestClient();
const limitedClient = new V1TestClient({ mutationRateLimit: { bucket: "default", limit: 1, windowMs: 60_000, scope: "user" } });
const operations = client.v1.routes;

type Envelope = { error: { code: string; message: string; fields?: Record<string, string[]> } };

function successStatus(route: (typeof operations)[number]["route"]): number {
  const status = Object.keys(route.responses).map(Number).find((s) => s >= 200 && s < 300);
  if (!status) throw new Error(`${route.path} declares no success response`);
  return status;
}

function declaredSchema(route: (typeof operations)[number]["route"], status: number): ZodType | undefined {
  const response = route.responses[status] as { content?: Record<string, { schema?: ZodType }> } | undefined;
  return response?.content?.["application/json"]?.schema;
}

function send(target: V1TestClient, world: V1World, req: FixtureRequest, headers: Record<string, string> = {}) {
  const token = req.token === undefined ? world.token : (req.token ?? undefined);
  return target.call(req.method ?? "GET", req.path, { token, body: req.body, query: req.query, headers });
}

async function expectEnvelope(response: Response, status: number, code: string): Promise<Envelope> {
  expect(response.status).toBe(status);
  const body = (await response.json()) as Envelope;
  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe("string");
  return body;
}

describe("the contract suite covers every /api/v1 endpoint", () => {
  it("has a fixture for every registered operation, and none for an operation that no longer exists", () => {
    const registered = operations.map((o) => o.operationId).sort();
    expect(Object.keys(V1_FIXTURES).sort()).toEqual(registered);
  });

  it("gives every operation a unique id, a path under /api/v1 once mounted, and error responses in the envelope shape", () => {
    expect(new Set(operations.map((o) => o.operationId)).size).toBe(operations.length);
    for (const { route, operationId } of operations) {
      for (const [status, response] of Object.entries(route.responses)) {
        if (Number(status) < 400) continue;
        expect(declaredSchema(route, Number(status)), `${operationId} ${status}`).toBeDefined();
        void response;
      }
    }
  });

  it("serves the OpenAPI document, and it describes every operation", async () => {
    const response = await client.call("GET", "/openapi.json");
    expect(response.status).toBe(200);
    const doc = (await response.json()) as { openapi: string; info: { title: string }; paths: Record<string, Record<string, { operationId: string }>>; components: { securitySchemes: object } };

    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("Birava API");
    expect(Object.keys(doc.components.securitySchemes)).toEqual(expect.arrayContaining(["bearerAuth", "cookieAuth"]));
    const documented = Object.values(doc.paths).flatMap((methods) => Object.values(methods).map((op) => op.operationId));
    expect(documented.sort()).toEqual(operations.map((o) => o.operationId).sort());
  });

  it("answers an unknown path with the 404 envelope", async () => {
    await expectEnvelope(await client.call("GET", "/nothing-here"), 404, "NOT_FOUND");
  });
});

describe.each(operations.map((o) => [o.operationId, o] as const))("%s", (operationId, operation) => {
  const fixture = V1_FIXTURES[operationId]!;
  const hasInput = Object.keys(operation.route.request ?? {}).length > 0;

  it("accepts valid input and answers in the declared shape", async () => {
    const world = await V1World.create();
    const req = await fixture.valid(world);

    const response = await send(client, world, req);

    const expected = req.status ?? successStatus(operation.route);
    expect(response.status, await response.clone().text()).toBe(expected);
    if (expected === 204) {
      expect(await response.text()).toBe("");
    } else {
      const schema = declaredSchema(operation.route, expected);
      const json: unknown = await response.json();
      if (schema) expect(() => schema.parse(json)).not.toThrow();
    }
  });

  if (hasInput) {
    it("rejects invalid input with a 400 and field-level errors", async () => {
      expect(fixture.invalid, `${operationId} takes input, so it needs an invalid fixture`).toBeDefined();
      const world = await V1World.create();
      const req = await fixture.invalid!(world);

      const body = await expectEnvelope(await send(client, world, req), 400, "VALIDATION_FAILED");

      expect(Object.keys(body.error.fields ?? {}).length).toBeGreaterThan(0);
    });
  } else {
    it("takes no input, so there is nothing to reject", () => {
      expect(fixture.invalid).toBeUndefined();
      expect(fixture.notes, `${operationId} should say why it has no invalid case`).toBeDefined();
    });
  }

  if (operation.authenticated) {
    it("refuses a caller with no credentials, and one with a token that does not exist", async () => {
      const world = await V1World.create();
      const req = await fixture.valid(world);

      await expectEnvelope(await send(client, world, { ...req, token: null }), 401, "UNAUTHENTICATED");
      await expectEnvelope(await send(client, world, { ...req, token: "0123456789abcdef-not-a-session" }), 401, "UNAUTHENTICATED");
    });
  }

  if (operation.authenticated && operation.mutating && fixture.repeatable !== false) {
    it("is rate limited per user, answering 429 with Retry-After", async () => {
      const world = await V1World.create();
      const req = await fixture.valid(world);

      const first = await send(limitedClient, world, req);
      expect(first.status).not.toBe(429);
      const second = await send(limitedClient, world, req);

      await expectEnvelope(second, 429, "RATE_LIMITED");
      expect(Number(second.headers.get("Retry-After"))).toBeGreaterThan(0);
    });

    {
      it("has no second effect when retried with the same Idempotency-Key", async () => {
        const world = await V1World.create();
        const req = await fixture.valid(world);
        const key = `contract-${operationId}-0001`;

        const first = await send(client, world, req, { "idempotency-key": key });
        const second = await send(client, world, req, { "idempotency-key": key });

        expect(second.status).toBe(first.status);
        expect(second.headers.get("Idempotent-Replay")).toBe("true");
        expect(first.headers.get("Idempotent-Replay")).toBeNull();
        expect(await second.text()).toBe(await first.text());
        expect(await db.idempotencyKey.count({ where: { key } })).toBe(1);
      });
    }
  }
});

describe("sign-in is limited per IP, not per user", () => {
  it("answers 429 with Retry-After after 30 attempts in five minutes", async () => {
    const world = await V1World.create();
    const attempt = () => client.call("POST", "/auth/token", { body: { email: world.user.email, password: "wrong" } });

    for (let i = 0; i < 30; i++) expect((await attempt()).status).toBe(401);
    const limited = await attempt();

    await expectEnvelope(limited, 429, "RATE_LIMITED");
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
