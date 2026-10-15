import { ActionGateway } from "./ActionGateway";
import type { GatewayServices } from "./GatewayServices";
import { RouteGateway } from "./RouteGateway";

/**
 * The one way to expose code to the outside: `gateway.route.*` for Route
 * Handlers, `gateway.action.*` for Server Actions. Built once per app in a
 * composition root that supplies authentication, rate limiting and logging.
 */
export class Gateway<TUser extends { id: string }> {
  readonly route: RouteGateway<TUser>;
  readonly action: ActionGateway<TUser>;

  constructor(services: GatewayServices<TUser>) {
    this.route = new RouteGateway(services);
    this.action = new ActionGateway(services);
  }
}
