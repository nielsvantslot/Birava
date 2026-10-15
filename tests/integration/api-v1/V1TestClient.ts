import type { OpenAPIHono } from "@hono/zod-openapi";
import { getCurrentUser } from "@/modules/identity/server/session";
import { PostgresIdempotencyStore } from "@/lib/gateway/PostgresIdempotencyStore";
import type { RateLimitSpec } from "@/lib/gateway/Models";
import { db } from "@/lib/db";
import { LoggerFactory } from "@/lib/logging/LoggerFactory";
import { RateLimiterFactory } from "@/lib/rateLimit/RateLimiterFactory";
import { V1AppFactory, type V1App } from "@/app/api/v1/_hono/V1AppFactory";
import type { V1Env } from "@/app/api/v1/_hono/V1Services";
import { withRequestHeaders } from "../setup";

export type CallOptions = {
  token?: string;
  body?: unknown;
  query?: Record<string, string>;
  headers?: Record<string, string>;
};

/** Calls the /api/v1 app in-process, the way a native client would: bearer token in, JSON out. */
export class V1TestClient {
  readonly v1: V1App;

  constructor(options: { mutationRateLimit?: RateLimitSpec; exposeDocument?: boolean } = {}) {
    this.v1 = V1AppFactory.create({
      authenticate: () => getCurrentUser(),
      rateLimiter: RateLimiterFactory.create(),
      idempotency: new PostgresIdempotencyStore(db),
      logger: LoggerFactory.create("api-v1-test", "error"),
      clientIp: () => "203.0.113.7",
      exposeDocument: options.exposeDocument ?? true,
      mutationRateLimit: options.mutationRateLimit,
    });
  }

  get app(): OpenAPIHono<V1Env> {
    return this.v1.app;
  }

  async call(method: string, path: string, options: CallOptions = {}): Promise<Response> {
    const url = new URL(`http://app.test/api/v1${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);

    const headers: Record<string, string> = { host: "app.test", ...(options.headers ?? {}) };
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    if (options.body !== undefined) headers["content-type"] = "application/json";

    const request = new Request(url, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    // next/headers' headers() is what getCurrentUser() reads the bearer token from.
    return withRequestHeaders(headers, async () => this.v1.app.fetch(request));
  }
}
