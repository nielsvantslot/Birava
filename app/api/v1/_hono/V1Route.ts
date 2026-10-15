import type { createRoute } from "@hono/zod-openapi";

/** A registered endpoint, for the generated document and for the contract tests that must cover every one. */
export type V1Route = {
  operationId: string;
  route: ReturnType<typeof createRoute>;
  /** Needs a signed-in user (a bearer token or a cookie session). */
  authenticated: boolean;
  /** Changes state (POST, PUT, PATCH, DELETE): rate limited and safe to retry with an Idempotency-Key. */
  mutating: boolean;
};

/**
 * Adds the security requirement to a route after it is created. (Passing
 * `security` into createRoute itself makes the library lose the request types
 * of the handler, so it is attached here instead.)
 */
export class V1Security {
  /** A native client's bearer token, or a browser's cookie session. */
  static any<R extends object>(route: R): R & { security: { bearerAuth?: string[]; cookieAuth?: string[] }[] } {
    return { ...route, security: [{ bearerAuth: [] }, { cookieAuth: [] }] };
  }

  /** Only a bearer token (the call makes no sense for a cookie session). */
  static bearer<R extends object>(route: R): R & { security: { bearerAuth?: string[]; cookieAuth?: string[] }[] } {
    return { ...route, security: [{ bearerAuth: [] }] };
  }
}
