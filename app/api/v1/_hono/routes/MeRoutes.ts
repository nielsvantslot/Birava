import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import type { V1Guards } from "../V1Guards";
import type { V1Env } from "../V1Services";
import { V1Responses, meSchema } from "../V1Schemas";
import { V1Security, type V1Route } from "../V1Route";

/** The signed-in user. */
export class MeRoutes {
  static register(app: OpenAPIHono<V1Env>, guards: V1Guards): V1Route[] {
    const getMe = V1Security.any(createRoute({
      method: "get",
      path: "/me",
      operationId: "getMe",
      tags: ["me"],
      summary: "Who this token or session belongs to",
      middleware: [guards.requireUser],
      responses: { 200: { description: "The signed-in user", content: { "application/json": { schema: meSchema } } }, ...V1Responses.errors(401) },
    }));
    app.openapi(getMe, (c) => c.json(c.var.user, 200));

    return [{ operationId: "getMe", route: getMe, authenticated: true, mutating: false }];
  }
}
