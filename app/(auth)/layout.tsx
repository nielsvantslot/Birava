import { ToastPill } from "@/components/ui/toast-pill";

// The nonce-based CSP (lib/security/ContentSecurityPolicyBuilder.ts) is
// generated fresh per request in middleware, and Next only stamps that nonce
// onto its own script tags for dynamically-rendered routes. Login/signup have
// no dynamic data dependency of their own (both pages are pure "use client"
// forms), so without this they got statically prerendered once at build time
// with no nonce baked into their <script> tags at all — the CSP header still
// carried a fresh nonce every request, but it never matched anything in the
// served HTML, so 'strict-dynamic' blocked every script and the page never
// hydrated. Confirmed live on both staging and production: zero `nonce=`
// attributes in the served HTML, X-Vercel-Cache: HIT/PRERENDER.
export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">{children}</div>
      {/* This layout has no toast host of its own otherwise — a page that
          redirects here (e.g. deleting your account from /settings) can
          still surface a message via toast-pill.tsx's queueToast(), which
          this picks up on mount. */}
      <ToastPill />
    </div>
  );
}
