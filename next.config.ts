import type { NextConfig } from "next";
import { HERO_WIDTHS } from "./lib/photoSizes";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
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
  // Client router cache: reuse a visited route for 30s before refetching, so
  // tab switches render instantly from memory instead of a skeleton round-trip.
  // Pull-to-refresh / reload bypasses it.
  experimental: {
    staleTimes: { dynamic: 30, static: 300 },
  },
  watchOptions: {
    pollIntervalMs: 1000,
  },
};

export default nextConfig;
