import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // End-to-end tests build into their own folder so they can run next to `npm run dev`
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    // TMDB posters, backdrops and episode stills
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org" }],
  },
};

export default nextConfig;
