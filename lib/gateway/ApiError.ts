import type { ErrorCode } from "./ErrorCode";

/** Field-level problems keyed by field path (dot-separated), each with one or more messages. */
export type FieldErrors = Record<string, string[]>;

/**
 * An *expected* failure a handler raises on purpose. The gateway turns it
 * into the error envelope (routes) or an `ActionFailure` (server actions).
 * Anything else a handler throws is unexpected and is logged, never shown.
 */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: FieldErrors,
    /** Seconds to wait; sent as `Retry-After` for RATE_LIMITED. */
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "ApiError";
  }

  static unauthenticated(message = "Not authenticated"): ApiError {
    return new ApiError("UNAUTHENTICATED", message);
  }

  static forbidden(message = "You can't do that."): ApiError {
    return new ApiError("FORBIDDEN", message);
  }

  static notFound(message = "Not found"): ApiError {
    return new ApiError("NOT_FOUND", message);
  }

  static validation(message: string, fields?: FieldErrors): ApiError {
    return new ApiError("VALIDATION_FAILED", message, fields);
  }

  static conflict(message: string): ApiError {
    return new ApiError("CONFLICT", message);
  }

  static rateLimited(message: string, retryAfterSeconds: number): ApiError {
    return new ApiError("RATE_LIMITED", message, undefined, retryAfterSeconds);
  }

  static upstream(message: string): ApiError {
    return new ApiError("UPSTREAM_FAILED", message);
  }
}
