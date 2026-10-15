/**
 * The closed list of error codes every gateway endpoint can return. Adding a
 * code is a deliberate, reviewed change: clients (web and, later, native)
 * switch on these, so they are part of the API contract.
 */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "CONFLICT",
  "RATE_LIMITED",
  "ORIGIN_MISMATCH",
  "CLIENT_CLOSED",
  "UPSTREAM_FAILED",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class ErrorCodes {
  private static readonly STATUS: Record<ErrorCode, number> = {
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    VALIDATION_FAILED: 400,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    ORIGIN_MISMATCH: 403,
    // Non-standard but widely used (nginx) for "the caller hung up".
    CLIENT_CLOSED: 499,
    UPSTREAM_FAILED: 502,
    INTERNAL: 500,
  };

  static httpStatus(code: ErrorCode): number {
    return ErrorCodes.STATUS[code];
  }
}
