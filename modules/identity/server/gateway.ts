import { headers } from "next/headers";
import { db } from "@/lib/db";
import { Gateway } from "@/lib/gateway/Gateway";
import type { GatewayServices } from "@/lib/gateway/GatewayServices";
import { PostgresIdempotencyStore } from "@/lib/gateway/PostgresIdempotencyStore";
import type { SessionUserDTO } from "@/lib/dtos";
import { LoggerFactory } from "@/lib/logging/LoggerFactory";
import { ClientIpResolver } from "@/lib/rateLimit/ClientIpResolver";
import { RateLimiterFactory } from "@/lib/rateLimit/RateLimiterFactory";
import { getCurrentUser } from "@/modules/identity/server/session";
import { verifyCronRequest } from "@/modules/identity/server/verifyCronRequest";

/**
 * The app's gateway: the single way a Route Handler or Server Action is
 * exposed (docs/adr/0002-gateway.md). Lives in identity because
 * authentication is what it adds to the platform's generic `lib/gateway`.
 *
 *   export const POST = gateway.route.authed({ name: "..." }, async ({ user }) => ...);
 *   export const doThing = gateway.action.authed({ name: "...", input: schema }, async ({ user, input }) => ...);
 */
/** The collaborators the gateway is built from, shared with the /api/v1 app so both enforce the same auth, limits and idempotency. */
export const gatewayServices: GatewayServices<SessionUserDTO> = {
  authenticator: { authenticate: () => getCurrentUser() },
  cronVerifier: { verify: verifyCronRequest },
  rateLimiter: RateLimiterFactory.create(),
  idempotency: new PostgresIdempotencyStore(db),
  logger: LoggerFactory.create("gateway"),
  clientIp: (request) => ClientIpResolver.resolve(request),
  clientIpFromHeaders: async () => ClientIpResolver.resolve(new Request("http://internal.invalid", { headers: await headers() })),
};

export const gateway = new Gateway<SessionUserDTO>(gatewayServices);
