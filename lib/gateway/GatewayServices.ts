import type { ILogger } from "@/lib/logging/ILogger";
import type { IRateLimiter } from "@/lib/rateLimit/IRateLimiter";
import type { IAuthenticator } from "./IAuthenticator";
import type { ICronVerifier } from "./ICronVerifier";

/** Everything the gateway needs from the outside world, injected once at the composition root. */
export type GatewayServices<TUser extends { id: string }> = {
  authenticator: IAuthenticator<TUser>;
  cronVerifier: ICronVerifier;
  rateLimiter: IRateLimiter;
  logger: ILogger;
  /** The caller's IP for a route handler's request. */
  clientIp: (request: Request) => string;
  /** The caller's IP inside a server action, where there is no Request object. */
  clientIpFromHeaders: () => Promise<string>;
};
