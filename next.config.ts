import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  cacheComponents: true,
  // Client router cache: reuse a visited route for 30s before refetching, so
  // tab switches render instantly from memory instead of a skeleton round-trip.
  // This is the only true staleness window; pull-to-refresh / reload bypasses
  // it, and write-time updateTag keeps the server cache event-fresh.
  experimental: {
    staleTimes: { dynamic: 30, static: 300 },
  },
  watchOptions: {
    pollIntervalMs: 1000,
  },
};

export default nextConfig;
