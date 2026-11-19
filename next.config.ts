import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "s2.coinmarketcap.com" }],
  },
};

export default nextConfig;
