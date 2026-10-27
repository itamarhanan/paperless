import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge sits over the reader's toolbar
  devIndicators: false,
  serverExternalPackages: ["playwright", "epub"],
};

export default nextConfig;
