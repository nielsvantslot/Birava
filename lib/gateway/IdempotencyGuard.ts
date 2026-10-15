import { createHash } from "node:crypto";
import { ApiError } from "./ApiError";
import type { IIdempotencyStore, IdempotencyScope } from "./IIdempotencyStore";
import { OriginGuard } from "./OriginGuard";

/** An `Idempotency-Key` is a client-chosen token (a UUID is typical). */
const KEY_PATTERN = /^[\w.:-]{8,128}$/;
/** A response bigger than this is not worth keeping; such a request just runs again on retry. */
const MAX_STORED_BODY_BYTES = 64 * 1024;

/**
 * Makes a mutating route safe to retry. A request carrying an
 * `Idempotency-Key` header runs once: the first successful response is kept
 * for a day and sent again (with `Idempotent-Replay: true`) to any repeat of
 * the same request. Reusing a key for a different request, or while the first
 * is still running, is a 409. Failures are never stored, so a failed request
 * can be retried with the same key.
 */
export class IdempotencyGuard {
  constructor(private readonly store: IIdempotencyStore) {}

  async run(request: Request, userId: string, route: string, execute: () => Promise<Response>): Promise<Response> {
    const key = request.headers.get("idempotency-key");
    if (key === null || !OriginGuard.isUnsafe(request.method)) return execute();
    if (!KEY_PATTERN.test(key)) throw ApiError.validation("Invalid Idempotency-Key header.");

    const scope: IdempotencyScope = { userId, key, route };
    const begun = await this.store.begin(scope, await this.fingerprint(request));

    if (begun.state === "replay") {
      const { status, contentType, body } = begun.response;
      const headers = new Headers({ "Idempotent-Replay": "true" });
      if (contentType) headers.set("Content-Type", contentType);
      return new Response(status === 204 ? null : body, { status, headers });
    }
    if (begun.state === "conflict") {
      throw ApiError.conflict(
        begun.reason === "in-progress"
          ? "A request with this Idempotency-Key is still being processed."
          : "This Idempotency-Key was already used for a different request."
      );
    }

    let response: Response;
    try {
      response = await execute();
    } catch (error) {
      await this.store.abandon(scope);
      throw error;
    }

    const stored = await this.storable(response);
    if (stored) await this.store.complete(scope, stored);
    else await this.store.abandon(scope);
    return response;
  }

  /** What identifies "the same request": method, path and query, and the body (only its size for an upload, which is too big to hash). */
  private async fingerprint(request: Request): Promise<string> {
    const url = new URL(request.url);
    const contentType = request.headers.get("content-type") ?? "";
    const body = contentType.startsWith("multipart/")
      ? `${contentType}|${request.headers.get("content-length") ?? ""}`
      : await request.clone().text();
    return createHash("sha256").update(`${request.method} ${url.pathname}${url.search}\n${body}`).digest("hex");
  }

  /** The part of a successful JSON (or empty) response worth replaying, or null when it should not be kept. */
  private async storable(response: Response): Promise<{ status: number; contentType: string | null; body: string } | null> {
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type");
    if (response.status !== 204 && !contentType?.includes("application/json")) return null;

    const body = response.status === 204 ? "" : await response.clone().text();
    if (Buffer.byteLength(body) > MAX_STORED_BODY_BYTES) return null;
    return { status: response.status, contentType, body };
  }
}
