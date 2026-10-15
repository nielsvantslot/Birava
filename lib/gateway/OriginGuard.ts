import { ApiError } from "./ApiError";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF hardening on top of SameSite cookies: a cookie-authenticated mutation
 * must come from this app's own origin. Browsers always send `Origin` on a
 * cross-origin POST, so a mismatch is rejected outright; when it is absent
 * (some same-origin requests, non-browser clients), `Sec-Fetch-Site` is the
 * fallback signal and only an explicit "cross-site" is refused.
 */
export class OriginGuard {
  static isUnsafe(method: string): boolean {
    return UNSAFE_METHODS.has(method.toUpperCase());
  }

  /** Throws ORIGIN_MISMATCH when an unsafe request does not originate from `request`'s own host. */
  static assertSameOrigin(request: Request): void {
    if (!OriginGuard.isUnsafe(request.method)) return;

    const origin = request.headers.get("origin");
    if (origin) {
      if (OriginGuard.hostOf(origin) !== OriginGuard.requestHost(request)) {
        throw new ApiError("ORIGIN_MISMATCH", "This request didn't come from the app.");
      }
      return;
    }

    if (request.headers.get("sec-fetch-site") === "cross-site") {
      throw new ApiError("ORIGIN_MISMATCH", "This request didn't come from the app.");
    }
  }

  /** The host the browser addressed: behind a proxy the original host is in x-forwarded-host. */
  private static requestHost(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    return forwarded || request.headers.get("host") || new URL(request.url).host;
  }

  private static hostOf(origin: string): string | null {
    try {
      return new URL(origin).host;
    } catch {
      return null;
    }
  }
}
