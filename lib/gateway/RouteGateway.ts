import type { ZodType } from "zod";
import { ApiError } from "./ApiError";
import { ErrorEnvelope } from "./ErrorEnvelope";
import type { GatewayServices } from "./GatewayServices";
import { InputParser } from "./InputParser";
import type { IpRateLimitSpec, Part, RateLimitSpec, RouteContextLike } from "./Models";
import { OriginGuard } from "./OriginGuard";
import { DEFAULT_USER_RATE_LIMIT, RateLimitGuard } from "./RateLimitGuard";

type InputSchemas = {
  /** Validates the dynamic route segments (for example `{ id: z.uuid() }`). */
  params?: ZodType;
  /** Validates the JSON body. */
  body?: ZodType;
  /** Validates the query string, as a plain object of its first values. */
  query?: ZodType;
  /** Validates a multipart form, as a plain object of its entries (files stay `File`). */
  form?: ZodType;
};

type RouteConfig<S extends InputSchemas> = S & {
  /** Names the endpoint in logs and in default rate-limit buckets. */
  name: string;
};

type AuthedRouteConfig<S extends InputSchemas> = RouteConfig<S> & {
  /** Overrides the default per-user mutation limit; `false` turns limiting off (for hot, cheap reads). */
  rateLimit?: RateLimitSpec | false;
};

type PublicRouteConfig<S extends InputSchemas> = RouteConfig<S> & {
  /** Required: an endpoint anyone can call must say how it is limited. `false` is an explicit, reviewed opt-out. */
  rateLimit: IpRateLimitSpec | false;
};

type Parsed<S extends InputSchemas> = {
  params: Part<S, "params">;
  body: Part<S, "body">;
  query: Part<S, "query">;
  form: Part<S, "form">;
};

type HandlerArgs<TUser, S extends InputSchemas> = {
  request: Request;
  user: TUser;
  input: Parsed<S>;
};

type PublicHandlerArgs<S extends InputSchemas> = Omit<HandlerArgs<never, S>, "user">;

/** What a handler may return: a Response (streams, images), null for 204, or any value to send as JSON. */
type HandlerResult = Promise<unknown>;

/**
 * Builds Next route handlers. Every handler passes through the same steps in
 * the same order: origin check (mutations), authentication, rate limit, input
 * validation, the handler itself, then error mapping to the envelope.
 * A handler returns a `Response` (streams, 204s, images) or any value, which
 * is sent as JSON; it signals expected failures by throwing `ApiError`.
 */
export class RouteGateway<TUser extends { id: string }> {
  private readonly rateLimits: RateLimitGuard;

  constructor(private readonly services: GatewayServices<TUser>) {
    this.rateLimits = new RateLimitGuard(services.rateLimiter, services.logger);
  }

  /** A route for signed-in users. */
  authed<S extends InputSchemas>(
    config: AuthedRouteConfig<S>,
    handler: (args: HandlerArgs<TUser, S>) => HandlerResult
  ): (request: Request, context: RouteContextLike) => Promise<Response> {
    return this.build(config, async (request, context) => {
      OriginGuard.assertSameOrigin(request);
      const user = await this.services.authenticator.authenticate();
      if (!user) throw ApiError.unauthenticated();
      const limit = config.rateLimit === undefined ? this.defaultFor(request) : config.rateLimit;
      if (limit) await this.rateLimits.consume(limit, config.name, limit.scope === "user" ? user.id : this.services.clientIp(request));
      const input = await this.parseInput(request, context, config);
      return handler({ request, user, input });
    });
  }

  /** A route anyone can call (login, signup, the error beacon). */
  public<S extends InputSchemas>(
    config: PublicRouteConfig<S>,
    handler: (args: PublicHandlerArgs<S>) => HandlerResult
  ): (request: Request, context: RouteContextLike) => Promise<Response> {
    return this.build(config, async (request, context) => {
      OriginGuard.assertSameOrigin(request);
      if (config.rateLimit) {
        await this.rateLimits.consume(config.rateLimit, config.name, this.services.clientIp(request));
      }
      const input = await this.parseInput(request, context, config);
      return handler({ request, input });
    });
  }

  /**
   * A scheduled job: authenticated by the shared cron secret instead of a
   * session, so there is no user, no origin check and no rate limit.
   */
  cron(
    config: { name: string },
    handler: (args: { request: Request }) => HandlerResult
  ): (request: Request) => Promise<Response> {
    const wrapped = this.build(config, async (request) => {
      if (!this.services.cronVerifier.verify(request)) throw ApiError.unauthenticated("Unauthorized");
      return handler({ request });
    });
    return (request) => wrapped(request, { params: Promise.resolve({}) });
  }

  private defaultFor(request: Request): RateLimitSpec | false {
    return OriginGuard.isUnsafe(request.method) ? DEFAULT_USER_RATE_LIMIT : false;
  }

  private async parseInput<S extends InputSchemas>(
    request: Request,
    context: RouteContextLike | undefined,
    config: RouteConfig<S>
  ): Promise<Parsed<S>> {
    const parsed: Record<string, unknown> = {};
    if (config.params) {
      parsed.params = InputParser.parse(config.params, (await context?.params) ?? {}, "Invalid address.");
    }
    if (config.query) {
      const query = Object.fromEntries(new URL(request.url).searchParams.entries());
      parsed.query = InputParser.parse(config.query, query, "Invalid query.");
    }
    if (config.body) {
      const raw = await request.json().catch(() => undefined);
      if (raw === undefined) throw ApiError.validation("Invalid request body.");
      parsed.body = InputParser.parse(config.body, raw, "Invalid request body.");
    }
    if (config.form) {
      const form = await request.formData().catch(() => null);
      if (!form) throw ApiError.validation("Invalid form.");
      parsed.form = InputParser.parse(config.form, Object.fromEntries(form.entries()), "Invalid form.");
    }
    return parsed as Parsed<S>;
  }

  private build(
    config: { name: string },
    run: (request: Request, context: RouteContextLike) => HandlerResult
  ): (request: Request, context: RouteContextLike) => Promise<Response> {
    return async (request, context) => {
      const logger = this.services.logger.child({ route: config.name, method: request.method });
      try {
        const result = await run(request, context);
        if (result instanceof Response) return result;
        if (result === null || result === undefined) return new Response(null, { status: 204 });
        return Response.json(result);
      } catch (error) {
        if (error instanceof ApiError) return ErrorEnvelope.response(error);
        logger.error("route handler threw", { url: new URL(request.url).pathname, error });
        return ErrorEnvelope.internalResponse();
      }
    };
  }
}
