import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { ApiError } from "@/lib/gateway/ApiError";
import { ControlFlow } from "@/lib/gateway/ControlFlow";
import { ErrorEnvelope } from "@/lib/gateway/ErrorEnvelope";
import { InputParser } from "@/lib/gateway/InputParser";
import { AuthRoutes } from "./routes/AuthRoutes";
import { CheckinRoutes } from "./routes/CheckinRoutes";
import { CrewRoutes } from "./routes/CrewRoutes";
import { MeRoutes } from "./routes/MeRoutes";
import { NotificationRoutes } from "./routes/NotificationRoutes";
import { SocialRoutes } from "./routes/SocialRoutes";
import { V1Guards } from "./V1Guards";
import type { V1Route } from "./V1Route";
import type { V1Env, V1Services } from "./V1Services";

export const V1_BASE_PATH = "/api/v1";

/**
 * Versioning policy: everything under /api/v1 is additive. A new field,
 * endpoint or optional parameter ships in v1; a removed or renamed field, a
 * changed meaning or a new required input ships as /api/v2 next to it, and v1
 * keeps working until its clients are gone.
 */
export const V1_INFO = {
  title: "Birava API",
  version: "1.0.0",
  description:
    "The Birava API for native clients. Sign in with POST /auth/token and send the token as a bearer token. " +
    "Every failure is `{ error: { code, message, fields? } }`. A mutation may carry an `Idempotency-Key` header: " +
    "repeating it returns the first response (marked `Idempotent-Replay: true`) with no second effect.",
};

export type V1App = {
  app: OpenAPIHono<V1Env>;
  routes: V1Route[];
};

/** Builds the /api/v1 app from its services. Production wiring is in V1Mount.ts; the contract tests build their own. */
export class V1AppFactory {
  static create(services: V1Services): V1App {
    const guards = new V1Guards(services);
    const app = new OpenAPIHono<V1Env>({
      defaultHook: (result) =>
        result.success ? undefined : ErrorEnvelope.response(ApiError.validation("Invalid request.", InputParser.fields(result.error.issues))),
    }).basePath(V1_BASE_PATH) as unknown as OpenAPIHono<V1Env>;

    app.onError((error) => {
      if (error instanceof ApiError) return ErrorEnvelope.response(error);
      if (ControlFlow.isNextControlFlow(error)) throw error;
      services.logger.error("api v1 handler threw", { error });
      return ErrorEnvelope.internalResponse();
    });
    app.notFound(() => ErrorEnvelope.response(ApiError.notFound("No such endpoint.")));

    app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", { type: "http", scheme: "bearer" });
    app.openAPIRegistry.registerComponent("securitySchemes", "cookieAuth", { type: "apiKey", in: "cookie", name: "birava_session" });

    const routes: V1Route[] = [
      ...AuthRoutes.register(app, guards),
      ...MeRoutes.register(app, guards),
      ...CheckinRoutes.register(app, guards),
      ...SocialRoutes.register(app, guards),
      ...CrewRoutes.register(app, guards),
      ...NotificationRoutes.register(app, guards),
    ];

    const document = createRoute({
      method: "get",
      path: "/openapi.json",
      operationId: "getOpenApiDocument",
      tags: ["meta"],
      summary: "This document",
      responses: { 200: { description: "The OpenAPI 3.1 document" } },
    });
    app.openapi(document, (c) => c.json(V1AppFactory.document(app), 200) as never);
    routes.push({ operationId: "getOpenApiDocument", route: document, authenticated: false, mutating: false });

    return { app, routes };
  }

  static document(app: OpenAPIHono<V1Env>) {
    return app.getOpenAPI31Document({ openapi: "3.1.0", info: V1_INFO, servers: [{ url: "/" }] });
  }
}
