/**
 * Reads the user-facing message out of a failed route's JSON body. Accepts
 * both a plain `{ error: "message" }` and an envelope
 * `{ error: { code, message } }`, so the client works with either server.
 */
export class ErrorMessageReader {
  static read(body: { error?: unknown } | null, fallback: string): string {
    const error = body?.error;
    if (typeof error === "string") return error;
    if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
      return error.message;
    }
    return fallback;
  }
}
