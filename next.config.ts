import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runtime stage
  // (Dockerfile copies .next/standalone). Required for the container build.
  output: "standalone",

  // Pin the tracing root to THIS project so the standalone bundle traces the
  // right files (silences the multi-lockfile workspace-root warning).
  outputFileTracingRoot: path.join(__dirname),

  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },

  // Lint runs as its own step (`npm run lint`) so a stylistic warning never
  // silently blocks a deploy build; type errors still fail the build.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },

  images: {
    formats: ["image/avif", "image/webp"],
    // Tenant logos / CDN assets are served from S3 + CloudFront in production.
    remotePatterns: [{ protocol: "https", hostname: "**.cloudfront.net" }],
  },

  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
};

export default nextConfig;
