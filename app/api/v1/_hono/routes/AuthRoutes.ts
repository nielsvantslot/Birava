import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { ApiError } from "@/lib/gateway/ApiError";
import { loginInput } from "@/modules/identity/contract/authContract";
import { cancelAccountDeletion } from "@/modules/identity";
import { issueSessionToken, revokeAllSessions, revokeSessionToken } from "@/modules/identity/server/session";
import { getSessionUserById, verifyCredentials } from "@/modules/identity/server/userQueries";
import { V1Guards } from "../V1Guards";
import type { V1Env } from "../V1Services";
import { V1Responses, meSchema } from "../V1Schemas";
import { V1Security, type V1Route } from "../V1Route";

const tokenResponseSchema = z.object({
  token: z.string().describe("Send as `Authorization: Bearer <token>`. Opaque; keep it secret."),
  expiresAt: z.string(),
  cancelledDeletion: z.boolean().optional().describe("True when signing in cancelled a pending account deletion."),
  user: meSchema,
});

/** Sign in for a native client, and end sessions. */
export class AuthRoutes {
  static register(app: OpenAPIHono<V1Env>, guards: V1Guards): V1Route[] {
    const createToken = createRoute({
      method: "post",
      path: "/auth/token",
      operationId: "createToken",
      tags: ["auth"],
      summary: "Sign in and get a bearer token",
      request: { body: { required: true, content: { "application/json": { schema: loginInput } } } },
      middleware: [
        guards.forPublic({
          bucket: "v1-token",
          limit: 30,
          windowMs: 5 * 60 * 1000,
          scope: "ip",
          message: "Too many sign-in attempts. Try again shortly.",
        }),
      ],
      responses: {
        200: { description: "Signed in", content: { "application/json": { schema: tokenResponseSchema } } },
        ...V1Responses.errors(400, 401, 429),
      },
    });
    app.openapi(createToken, async (c) => {
      const { email, password } = c.req.valid("json");
      const normalized = email.trim().toLowerCase();
      if (!normalized || !password) throw ApiError.validation("Email and password are required.");
      await guards.consumeAccountAttempt(normalized);

      const userId = await verifyCredentials(normalized, password);
      if (!userId) throw ApiError.unauthenticated("Invalid email or password.");

      const { token, expiresAt } = await issueSessionToken(userId);
      const cancelledDeletion = await cancelAccountDeletion(userId);
      const user = await getSessionUserById(userId);
      if (!user) throw ApiError.unauthenticated();
      return c.json({ token, expiresAt: expiresAt.toISOString(), ...(cancelledDeletion && { cancelledDeletion: true }), user }, 200);
    });

    const revokeToken = V1Security.bearer(createRoute({
      method: "delete",
      path: "/auth/token",
      operationId: "revokeToken",
      tags: ["auth"],
      summary: "Sign out: revoke the bearer token this request uses",
      middleware: [guards.requireUser],
      responses: { 204: { description: "Token revoked" }, ...V1Responses.errors(401, 429) },
    }));
    app.openapi(revokeToken, async (c) => {
      // With a cookie session present the caller is the cookie user, not the bearer token's owner: refuse rather than
      // revoke a token that may belong to someone else.
      const token = /^Bearer\s+(\S+)$/i.exec(c.req.header("authorization") ?? "")?.[1];
      if (!token || V1Guards.hasSessionCookie(c.req.header("cookie"))) {
        throw ApiError.validation("Send the token to revoke as a bearer token, without a session cookie.");
      }
      await revokeSessionToken(token);
      return c.body(null, 204);
    });

    const logoutAll = V1Security.any(createRoute({
      method: "post",
      path: "/auth/logout-all",
      operationId: "logoutEverywhere",
      tags: ["auth"],
      summary: "Sign out everywhere: end every session and token this user has",
      middleware: [guards.requireUser],
      responses: { 204: { description: "All sessions ended" }, ...V1Responses.errors(401, 429) },
    }));
    app.openapi(logoutAll, async (c) => {
      await revokeAllSessions(c.var.user.id);
      return c.body(null, 204);
    });

    return [
      { operationId: "createToken", route: createToken, authenticated: false, mutating: true },
      { operationId: "revokeToken", route: revokeToken, authenticated: true, mutating: true },
      { operationId: "logoutEverywhere", route: logoutAll, authenticated: true, mutating: true },
    ];
  }
}
