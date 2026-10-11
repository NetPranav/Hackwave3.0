import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "github.com" }, { protocol: "https", hostname: "avatars.githubusercontent.com" }] },
  partialPrefetching: true,
  // Next's built-in MCP server writes every dev log line to .next/dev/logs/next-development.log; in this repo that
  // write retriggers a compile, which logs again: an endless "✓ Compiled" loop that reloads the browser every second
  // and leaves the dashboard OFFLINE (found 2026-10-12). We don't use it.
  experimental: { mcpServer: false },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
