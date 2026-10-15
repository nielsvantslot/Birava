import { ApiError } from "@/lib/gateway/ApiError";
import type { ErrorCode } from "@/lib/gateway/ErrorCode";

type FailureShape = { error: string; code?: ErrorCode; fields?: Record<string, string[]> };

/**
 * Turns what the web actions and reads return into API responses. The actions
 * report a refusal as `{ error }` (with a `code` when the gateway produced
 * it); this raises it as an `ApiError`, so the app's one error handler answers
 * with the standard envelope. A refusal that carries no code is a domain rule
 * speaking in plain words, so its status is read from the wording: "not found"
 * is a 404, "only the owner can" is a 403, anything else a 400.
 */
export class V1Result {
  /** The result without the web-only cache list, or throws if it is a failure. */
  static unwrap<T extends object>(result: T): Omit<T, "error" | "revalidatedPaths"> {
    const failure = result as Partial<FailureShape>;
    if (typeof failure.error === "string" && failure.error !== "") {
      throw new ApiError(failure.code ?? V1Result.codeFor(failure.error), failure.error, failure.fields);
    }
    const kept = Object.entries(result).filter(([key]) => key !== "error" && key !== "revalidatedPaths");
    return Object.fromEntries(kept) as Omit<T, "error" | "revalidatedPaths">;
  }

  /** For actions that return nothing: raises a failure, otherwise there is nothing to return. */
  static assertOk(result: unknown): void {
    if (typeof result === "object" && result !== null) V1Result.unwrap(result);
  }

  private static codeFor(message: string): ErrorCode {
    if (/not found|doesn't match|no such/i.test(message)) return "NOT_FOUND";
    if (/only the .* can|not allowed|can't do that|banned|not a member/i.test(message)) return "FORBIDDEN";
    return "VALIDATION_FAILED";
  }
}
