import { ApiError, type FieldErrors } from "./ApiError";
import { ErrorCodes, type ErrorCode } from "./ErrorCode";

/** The one JSON shape every failing gateway route returns. */
export type ErrorEnvelopeBody = {
  error: { code: ErrorCode; message: string; fields?: FieldErrors };
};

/** What a failing server action returns. A superset of the web UI's `{ error?: string }` results. */
export type ActionFailure = {
  error: string;
  code: ErrorCode;
  fields?: FieldErrors;
};

export class ErrorEnvelope {
  static body(error: ApiError): ErrorEnvelopeBody {
    return {
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
      },
    };
  }

  static response(error: ApiError): Response {
    const headers: Record<string, string> = {};
    if (error.retryAfterSeconds !== undefined) headers["Retry-After"] = String(error.retryAfterSeconds);
    return Response.json(ErrorEnvelope.body(error), { status: ErrorCodes.httpStatus(error.code), headers });
  }

  static internalResponse(): Response {
    return ErrorEnvelope.response(new ApiError("INTERNAL", "Something went wrong. Try again."));
  }

  static actionFailure(error: ApiError): ActionFailure {
    return {
      error: error.message,
      code: error.code,
      ...(error.fields ? { fields: error.fields } : {}),
    };
  }

  /** Reads a message out of a parsed error response body, in the envelope shape or the legacy `{ error: string }` one. */
  static messageFrom(body: unknown, fallback: string): string {
    if (typeof body !== "object" || body === null || !("error" in body)) return fallback;
    const error = (body as { error: unknown }).error;
    if (typeof error === "string") return error;
    if (typeof error === "object" && error !== null && "message" in error) {
      const message = (error as { message: unknown }).message;
      if (typeof message === "string") return message;
    }
    return fallback;
  }
}
