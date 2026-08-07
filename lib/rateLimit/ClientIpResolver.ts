export class ClientIpResolver {
  /**
   * Vercel sets x-forwarded-for on every request that reaches the app.
   * Falls back to a shared key when absent (local dev, tests) — that
   * under-protects those environments instead of throwing, which is the
   * right trade-off since they're not the thing being defended.
   */
  static resolve(request: Request): string {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (!forwardedFor) return "unknown";
    return forwardedFor.split(",")[0].trim();
  }
}
