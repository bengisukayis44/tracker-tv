import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // TVmaze posters, backdrops and episode stills
    remotePatterns: [{ protocol: "https", hostname: "static.tvmaze.com" }],
  },
};

export default nextConfig;
