import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  watchOptions: {
    pollIntervalMs: 1000,
  },
};

export default nextConfig;
