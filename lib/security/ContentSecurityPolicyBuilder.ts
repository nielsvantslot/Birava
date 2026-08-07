import crypto from "crypto";
import { ContentSecurityPolicyResult } from "@/lib/security/Models";

/**
 * Nonce-based CSP, generated fresh per request. `script-src` uses
 * 'strict-dynamic' (Next's documented pattern) so the nonce on Next's own
 * inline hydration/RSC-streaming scripts propagates trust to whatever those
 * scripts inject for code-split chunks, without needing 'unsafe-inline'.
 * `style-src` keeps 'unsafe-inline' since the app renders inline `style={{}}`
 * attributes throughout — nonces don't cover style attributes, only
 * `<style>` elements, so there's no equivalent lockdown available there.
 * `img-src` allowlists the CARTO tile subdomains the session map renders as
 * direct `<image>` hrefs (lib/mapProjection.ts), plus blob:/data: for
 * client-side photo previews and base64 LQIP placeholders. `connect-src`
 * allowlists Nominatim, which log-drink-form.tsx calls directly from the
 * browser for reverse geocoding.
 */
export class ContentSecurityPolicyBuilder {
  static build(): ContentSecurityPolicyResult {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    // Next's dev-mode Fast Refresh runtime evals code to apply hot updates —
    // production never does this, so 'unsafe-eval' is scoped to dev only.
    const scriptSrc =
      process.env.NODE_ENV === "production"
        ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
        : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;
    const directives = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https://*.basemaps.cartocdn.com",
      "font-src 'self'",
      "connect-src 'self' https://nominatim.openstreetmap.org",
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ];

    return { nonce, headerValue: directives.join("; ") };
  }
}
