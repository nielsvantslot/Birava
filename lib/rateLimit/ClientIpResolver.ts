export class ClientIpResolver {
  /**
   * Vercel's edge *appends* the real connecting IP as the last hop of
   * whatever x-forwarded-for chain a request already had — it never
   * strips or replaces client-supplied entries ahead of it. Taking the
   * FIRST entry (a previous version of this method did) reads whatever the
   * client itself claims to be, which a raw request can set to anything —
   * a trivial rate-limit bypass, since a fresh fake IP on every request
   * lands each one in a brand new bucket (login:${ip}/signup:${ip}).
   * Taking the LAST entry reads Vercel's own append, the one hop the
   * client can't control.
   *
   * Falls back to a shared key when the header is absent (local dev,
   * tests) — that under-protects those environments instead of throwing,
   * which is the right trade-off since they're not the thing being
   * defended.
   */
  static resolve(request: Request): string {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (!forwardedFor) return "unknown";
    const hops = forwardedFor.split(",").map((h) => h.trim());
    return hops[hops.length - 1];
  }
}
