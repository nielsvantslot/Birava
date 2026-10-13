/**
 * Browser-visible configuration. Next.js inlines `process.env.NEXT_PUBLIC_*`
 * and `process.env.NODE_ENV` at build time only when written as a literal
 * property access, so each is read explicitly here rather than through a
 * generic lookup — that would silently return undefined in the browser.
 */
export class PublicEnv {
  static readonly vapidPublicKey: string | undefined = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  /** Opt-in: register the service worker against `next dev` (see .env.example). */
  static readonly forceServiceWorkerInDev: boolean = Boolean(process.env.NEXT_PUBLIC_FORCE_SW_IN_DEV);

  static readonly isProduction: boolean = process.env.NODE_ENV === "production";
}
