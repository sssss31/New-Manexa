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

  // Production security headers on every response. CSP is intentionally
  // report-friendly (no inline-script ban) because Next injects inline
  // bootstrap scripts; the high-value protections here are clickjacking,
  // MIME sniffing, HTTPS pinning and permission lockdown.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
