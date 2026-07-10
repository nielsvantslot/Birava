import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
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
