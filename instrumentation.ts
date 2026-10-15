import type { Instrumentation } from "next";
import { registerOTel } from "@vercel/otel";

/**
 * Runs once when the server starts.
 *
 * - Tracing: @vercel/otel instruments route handlers, server components and
 *   fetches. It exports nothing until an OTLP endpoint is configured
 *   (OTEL_EXPORTER_OTLP_ENDPOINT), or the host collects it (Vercel), so it is
 *   free to leave on and vendor-neutral — a Sentry or Grafana backend is just
 *   an endpoint away.
 * - Validating the environment here makes a missing or malformed variable
 *   fail the boot with one readable message instead of the first request
 *   that needs it (see lib/env/ServerEnvParser.ts).
 */
export async function register() {
  registerOTel({ serviceName: "birava" });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { Env } = await import("@/lib/env/Env");
    void Env.server;
  }
}

/**
 * Next calls this for every unhandled server error (render, route handler,
 * server action, middleware) with the route context — so a failure is logged
 * with its stack and request id even if no user ever reports it.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { LoggerFactory } = await import("@/lib/logging/LoggerFactory");
  const requestId = request.headers["x-request-id"];
  LoggerFactory.create("request").error("unhandled request error", {
    error,
    digest: (error as { digest?: string }).digest,
    requestId: Array.isArray(requestId) ? requestId[0] : requestId,
    method: request.method,
    // Path only: query strings can carry invite codes or tokens.
    path: request.path.split("?")[0],
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    renderSource: context.renderSource,
  });
};
