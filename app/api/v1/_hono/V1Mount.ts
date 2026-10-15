import { Env } from "@/lib/env/Env";
import { ClientIpResolver } from "@/lib/rateLimit/ClientIpResolver";
import { LoggerFactory } from "@/lib/logging/LoggerFactory";
import { gatewayServices } from "@/modules/identity/server/gateway";
import { V1AppFactory, type V1App } from "./V1AppFactory";

/** The production /api/v1 app, built once from the same services the web gateway uses. */
export class V1Mount {
  private static instance: V1App | undefined;

  static get(): V1App {
    V1Mount.instance ??= V1AppFactory.create({
      authenticate: gatewayServices.authenticator.authenticate.bind(gatewayServices.authenticator),
      rateLimiter: gatewayServices.rateLimiter,
      idempotency: gatewayServices.idempotency,
      logger: LoggerFactory.create("api-v1"),
      clientIp: (request) => ClientIpResolver.resolve(request),
      // Public API clients read the committed document; production does not hand out a map of every endpoint.
      exposeDocument: V1Mount.isNonProduction(),
    });
    return V1Mount.instance;
  }

  /** Fail closed: only a known dev or preview environment serves the document, so an unset VERCEL_ENV (self-hosted production) does not. */
  private static isNonProduction(): boolean {
    const { VERCEL_ENV, NODE_ENV } = Env.server;
    return VERCEL_ENV === "preview" || VERCEL_ENV === "development" || (VERCEL_ENV === undefined && NODE_ENV !== "production");
  }
}
