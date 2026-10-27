import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge sits over the reader's toolbar
  devIndicators: false,
  env: {
    // Names the service worker's cache, so each deploy replaces the last one's
    SW_VERSION:
      process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || Date.now().toString(36),
  },
  async headers() {
    return [
      {
        // Always checked for a new version; never kept in the HTTP cache
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
