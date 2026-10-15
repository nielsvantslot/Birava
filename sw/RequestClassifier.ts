/** Pure decisions about a request, kept apart from the worker so they can be unit tested. */
export class RequestClassifier {
  /**
   * Next's App Router client-side <Link> transitions never do a real browser
   * navigation (mode: "navigate") — they fetch just the RSC payload for the
   * new route, marked with an `RSC: 1` request header and a `_rsc=<hash>`
   * cache-busting query param. Only the very first hard load of a session is
   * an actual navigation; everything reached by clicking around afterward is
   * this. Missing that meant only the landing page ever got cached.
   */
  static isRscRequest(headers: { get(name: string): string | null }, url: URL): boolean {
    return headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  }

  /**
   * The hash in `_rsc` reflects the *current* route's client state, not the
   * destination, so the same target page can arrive under different hashes
   * depending on where you navigated from — strip it so they all share one
   * cache entry instead of colliding into cache misses.
   */
  static pageCacheKey(url: string | URL): string {
    const key = new URL(url);
    key.searchParams.delete("_rsc");
    return key.toString();
  }

  static isStaticAsset(url: URL): boolean {
    return url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons") || url.pathname === "/manifest.webmanifest";
  }

  static isMediaAsset(url: URL): boolean {
    return url.pathname.startsWith("/api/avatars/") || url.pathname.startsWith("/api/photos/");
  }

  /** A real navigation or client-side RSC transition to an app route: server-rendered and auth-sensitive. */
  static isPageContent(url: URL, ownOrigin: string): boolean {
    return !url.pathname.startsWith("/api/") && !RequestClassifier.isStaticAsset(url) && url.origin === ownOrigin;
  }
}
