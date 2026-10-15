import { gateway } from "@/modules/identity/server/gateway";
import { V1Mount } from "../_hono/V1Mount";

// The versioned public API (docs/adr/0003-public-api-v1.md): one Hono app, mounted
// whole. It applies the gateway's steps per endpoint (auth, limits, validation,
// idempotency, the error envelope); the mounted gateway route only adds the
// shared outer contract. The OpenAPI document is served at /api/v1/openapi.json.
const mount = { name: "api.v1" };
const handle = (request: Request) => V1Mount.get().app.fetch(request);

export const GET = gateway.route.mounted(mount, handle);
export const POST = gateway.route.mounted(mount, handle);
export const PUT = gateway.route.mounted(mount, handle);
export const PATCH = gateway.route.mounted(mount, handle);
export const DELETE = gateway.route.mounted(mount, handle);
