import { headers } from "next/headers";

/**
 * The id middleware stamps on every request (modules/identity/server/proxy-session.ts), so
 * every log line from one request can be found with a single search.
 */
export class RequestContext {
  static readonly HEADER = "x-request-id";

  /** Undefined outside a request scope (scripts, tests, module init). */
  static async requestId(): Promise<string | undefined> {
    try {
      return (await headers()).get(RequestContext.HEADER) ?? undefined;
    } catch {
      return undefined;
    }
  }

  /** Accepts a caller-supplied id only if it is a plain token, else mints one. */
  static resolve(incoming: string | null): string {
    return incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  }
}
