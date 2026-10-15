import type { ZodType, z } from "zod";
import { ApiError } from "./ApiError";
import { ErrorEnvelope, type ActionFailure } from "./ErrorEnvelope";
import type { GatewayServices } from "./GatewayServices";
import { InputParser } from "./InputParser";
import type { Infer, IpRateLimitSpec, RateLimitSpec } from "./Models";
import { DEFAULT_USER_RATE_LIMIT, RateLimitGuard } from "./RateLimitGuard";

type ActionConfig<S extends ZodType | undefined> = {
  /** Names the action in logs and in default rate-limit buckets. */
  name: string;
  /** Validates the argument the client passed. Omit for an action that takes none. */
  input?: S;
};

type AuthedActionConfig<S extends ZodType | undefined> = ActionConfig<S> & {
  /** Overrides the default per-user limit; `false` turns limiting off. */
  rateLimit?: RateLimitSpec | false;
};

type PublicActionConfig<S extends ZodType | undefined> = ActionConfig<S> & {
  /** Required: an action anyone can call must say how it is limited. `false` is an explicit, reviewed opt-out. */
  rateLimit: IpRateLimitSpec | false;
};

type ActionArgs<S extends ZodType | undefined> = S extends ZodType ? [input: z.input<S>] : [];

/**
 * What a caller sees: the handler's result, plus the failure shape. When the
 * result type already accepts a failure (every web DTO is all-optional with
 * an `error?`), the failure folds into it, so callers keep reading
 * `result.error` and the success fields without narrowing.
 */
export type ActionResult<R> = ActionFailure extends R ? R : R | ActionFailure;

/**
 * Builds server actions. Same steps as `RouteGateway` (authenticate, rate
 * limit, validate, run, map errors) with results in place of HTTP: a failing
 * action returns an `ActionFailure` (a superset of the `{ error?: string }`
 * the web UI already reads), and an unexpected throw is logged and rethrown
 * so Next shows its generic error rather than leaking details.
 * Next already compares Origin to Host for server actions, so no origin
 * check is needed here.
 */
export class ActionGateway<TUser extends { id: string }> {
  private readonly rateLimits: RateLimitGuard;

  constructor(private readonly services: GatewayServices<TUser>) {
    this.rateLimits = new RateLimitGuard(services.rateLimiter, services.logger);
  }

  /** An action for signed-in users. */
  authed<S extends ZodType | undefined = undefined, R = void>(
    config: AuthedActionConfig<S>,
    handler: (args: { user: TUser; input: Infer<S> }) => Promise<R>
  ): (...args: ActionArgs<S>) => Promise<ActionResult<R>> {
    return this.build<S, R>(config, async (raw) => {
      const user = await this.services.authenticator.authenticate();
      if (!user) throw ApiError.unauthenticated();
      const limit = config.rateLimit === undefined ? DEFAULT_USER_RATE_LIMIT : config.rateLimit;
      if (limit) await this.rateLimits.consume(limit, config.name, limit.scope === "user" ? user.id : await this.services.clientIpFromHeaders());
      return handler({ user, input: this.parse(config, raw) });
    });
  }

  /** An action anyone can call. */
  public<S extends ZodType | undefined = undefined, R = void>(
    config: PublicActionConfig<S>,
    handler: (args: { input: Infer<S> }) => Promise<R>
  ): (...args: ActionArgs<S>) => Promise<ActionResult<R>> {
    return this.build<S, R>(config, async (raw) => {
      if (config.rateLimit) {
        await this.rateLimits.consume(config.rateLimit, config.name, await this.services.clientIpFromHeaders());
      }
      return handler({ input: this.parse(config, raw) });
    });
  }

  private parse<S extends ZodType | undefined>(config: ActionConfig<S>, raw: unknown): Infer<S> {
    if (!config.input) return undefined as Infer<S>;
    return InputParser.parse(config.input, raw, "Invalid input.") as Infer<S>;
  }

  private build<S extends ZodType | undefined, R>(
    config: ActionConfig<S>,
    run: (raw: unknown) => Promise<R>
  ): (...args: ActionArgs<S>) => Promise<ActionResult<R>> {
    return (async (...args: unknown[]) => {
      try {
        return await run(args[0]);
      } catch (error) {
        if (error instanceof ApiError) return ErrorEnvelope.actionFailure(error);
        this.services.logger.error("server action threw", { action: config.name, error });
        throw error;
      }
    }) as (...args: ActionArgs<S>) => Promise<ActionResult<R>>;
  }
}
