import type { NextConfig } from "next";
import { HERO_WIDTHS } from "./lib/photoSizes";

const SECURITY_HEADERS = [
  // CSP is set per-request in lib/auth/proxy-session.ts (needs a fresh nonce
  // each time) — everything else here is static and safe to apply globally,
  // including to api/ routes and static assets that middleware's matcher
  // skips for the CSP/auth pass.
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Legacy fallback for browsers that predate CSP's frame-ancestors; nothing
  // in this app is ever meant to be iframed.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // geolocation: check-in venue capture (log-drink-form.tsx). web-share: the
  // native share sheet (share-sheet.tsx/social-row.tsx). Everything else this
  // app never touches.
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), web-share=(self), camera=(), microphone=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
  images: {
    loader: "custom",
    loaderFile: "./lib/imageLoader.ts",
    // Trimmed to the widths the session-card hero photo actually requests
    // (lib/photoSizes.ts) — the defaults go up to 3840, far past anything
    // this app ever renders.
    deviceSizes: HERO_WIDTHS,
    // No other next/image usage in this app needs small fixed-size icons —
    // leaving Next's default imageSizes in place would let it generate
    // srcSet candidates (16-256px) our photo route's HERO_WIDTHS allowlist
    // doesn't accept, which would silently fall back to serving the full
    // (large) image for those candidates instead of a small one.
    imageSizes: [],
  },
  // Client router cache: dynamic routes always refetch on navigation (dynamic: 0).
  // A 30s reuse window previously let tab switches (e.g. bottom nav back to
  // /dashboard or /crews) serve a client-cached page from before a check-in,
  // even though revalidatePath had already busted the server-side cache —
  // the new check-in only appeared after a full app reload. See #160.
  experimental: {
    staleTimes: { dynamic: 0, static: 300 },
  },
  watchOptions: {
    pollIntervalMs: 1000,
  },
  webpack: (config) => {
    // Local dev's photo storage (LocalDiskStorageAdapter) writes uploaded
    // check-in photos into public/uploads/ — inside the watched project
    // tree, so every upload was triggering a Fast Refresh. That's
    // disruptive on its own, and in the E2E suite it actively cancels
    // in-flight navigations (observed: a 200 response immediately followed
    // by net::ERR_ABORTED the instant "[Fast Refresh] rebuilding" fires),
    // which cascaded into seemingly unrelated test failures well after the
    // upload itself. Next's own `watchOptions` config (above) doesn't expose
    // `ignored` — this goes straight at webpack's.
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/public/uploads/**"],
    };
    return config;
  },
};

export default nextConfig;
