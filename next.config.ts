import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Baseline security headers — applied in every environment.
 * Kept conservative so local tooling and embedded previews keep working.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

/**
 * Production-only hardening.
 * CSP allows `unsafe-inline`/`unsafe-eval` for scripts because the Next.js
 * runtime injects inline bootstrap scripts; images accept data:/blob: (the
 * product image pipeline compresses to data URIs) plus https:/http: because
 * shop owners can paste external product image URLs.
 */
const prodHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: false,
  headers: async () => [
    {
      source: "/:path*",
      headers: isProd ? [...securityHeaders, ...prodHeaders] : securityHeaders,
    },
  ],
};

export default nextConfig;
