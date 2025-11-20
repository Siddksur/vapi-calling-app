import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Enable server actions if needed
    // instrumentationHook: false, // Disabled - scheduler initializes via API route instead
  },
};

export default nextConfig;
