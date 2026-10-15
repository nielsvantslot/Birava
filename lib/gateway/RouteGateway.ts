import type { ZodType } from "zod";
import { ApiError } from "./ApiError";
import { ErrorEnvelope } from "./ErrorEnvelope";
import type { GatewayServices } from "./GatewayServices";
import { InputParser } from "./InputParser";
import type { Part, RateLimitSpec, RouteContextLike } from "./Models";
import { OriginGuard } from "./OriginGuard";
import { DEFAULT_USER_RATE_LIMIT, RateLimitGuard } from "./RateLimitGuard";

type InputSchemas = {
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
  rateLimit: RateLimitSpec | false;
};

type Parsed<S extends InputSchemas> = {
  body: Part<S, "body">;
  query: Part<S, "query">;
  form: Part<S, "form">;
};

type HandlerArgs<TUser, Ctx extends RouteContextLike, S extends InputSchemas> = {
  request: Request;
  user: TUser;
  params: Awaited<Ctx["params"]>;
  input: Parsed<S>;
};

type PublicHandlerArgs<Ctx extends RouteContextLike, S extends InputSchemas> = Omit<HandlerArgs<never, Ctx, S>, "user">;

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
    this.rateLimits = new RateLimitGuard(services.rateLimiter);
  }

  /** A route for signed-in users. */
  authed<Ctx extends RouteContextLike = RouteContextLike, S extends InputSchemas = InputSchemas>(
    config: AuthedRouteConfig<S>,
    handler: (args: HandlerArgs<TUser, Ctx, S>) => Promise<Response | object | null | undefined>
  ): (request: Request, context: Ctx) => Promise<Response> {
    return this.build<Ctx, S>(config, async (request, context) => {
      OriginGuard.assertSameOrigin(request);
      const user = await this.services.authenticator.authenticate();
      if (!user) throw ApiError.unauthenticated();
      const limit = config.rateLimit === undefined ? this.defaultFor(request) : config.rateLimit;
      if (limit) await this.rateLimits.consume(limit, config.name, limit.scope === "user" ? user.id : this.services.clientIp(request));
      const input = await this.parseInput(request, config);
      return handler({ request, user, params: (await context?.params) as Awaited<Ctx["params"]>, input });
    });
  }

  /** A route anyone can call (login, signup, the error beacon). */
  public<Ctx extends RouteContextLike = RouteContextLike, S extends InputSchemas = InputSchemas>(
    config: PublicRouteConfig<S>,
    handler: (args: PublicHandlerArgs<Ctx, S>) => Promise<Response | object | null | undefined>
  ): (request: Request, context: Ctx) => Promise<Response> {
    return this.build<Ctx, S>(config, async (request, context) => {
      OriginGuard.assertSameOrigin(request);
      if (config.rateLimit) {
        const subject = config.rateLimit.scope === "user" ? "anonymous" : this.services.clientIp(request);
        await this.rateLimits.consume(config.rateLimit, config.name, subject);
      }
      const input = await this.parseInput(request, config);
      return handler({ request, params: (await context?.params) as Awaited<Ctx["params"]>, input });
    });
  }

  /**
   * A scheduled job: authenticated by the shared cron secret instead of a
   * session, so there is no user, no origin check and no rate limit.
   */
  cron(
    config: { name: string },
    handler: (args: { request: Request }) => Promise<Response | object | null | undefined>
  ): (request: Request) => Promise<Response> {
    const wrapped = this.build<RouteContextLike, InputSchemas>(config as RouteConfig<InputSchemas>, async (request) => {
      if (!this.services.cronVerifier.verify(request)) throw ApiError.unauthenticated("Unauthorized");
      return handler({ request });
    });
    return (request) => wrapped(request, { params: Promise.resolve({}) });
  }

  private defaultFor(request: Request): RateLimitSpec | false {
    return OriginGuard.isUnsafe(request.method) ? DEFAULT_USER_RATE_LIMIT : false;
  }

  private async parseInput<S extends InputSchemas>(request: Request, config: RouteConfig<S>): Promise<Parsed<S>> {
    const parsed: Record<string, unknown> = {};
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

  private build<Ctx extends RouteContextLike, S extends InputSchemas>(
    config: RouteConfig<S>,
    run: (request: Request, context: Ctx) => Promise<Response | object | null | undefined>
  ): (request: Request, context: Ctx) => Promise<Response> {
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
