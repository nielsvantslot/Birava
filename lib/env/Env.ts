import { ServerEnvParser } from "@/lib/env/ServerEnvParser";
import type { ServerEnvValues } from "@/lib/env/Models";

/**
 * The only place server code reads `process.env` (an ESLint rule enforces
 * it). Server-only: the client has no DATABASE_URL, so importing this from a
 * component fails loudly instead of silently reading undefined. Client code
 * uses lib/env/PublicEnv.ts.
 */
export class Env {
  private static cached: ServerEnvValues | undefined;

  static get server(): ServerEnvValues {
    if (typeof window !== "undefined") {
      throw new Error("Env.server is server-only; use PublicEnv in client code.");
    }
    Env.cached ??= ServerEnvParser.parse(process.env);
    return Env.cached;
  }

  static get isProduction(): boolean {
    return Env.server.NODE_ENV === "production";
  }

  /** True on a Vercel preview (staging) deployment. */
  static get isStaging(): boolean {
    return Env.server.VERCEL_ENV === "preview";
  }

  /** For tests that change process.env between cases. */
  static reset(): void {
    Env.cached = undefined;
  }
}
