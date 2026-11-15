/**
 * Next.js configuration.
 *
 * Purpose: build a self-contained server bundle for Cloud Run and send
 * strict security headers with every response.
 */
import type { NextConfig } from 'next';

// ----- Development needs eval and a websocket for hot reload; the
// production policy allows neither.
const IS_DEV = process.env.NODE_ENV !== 'production';
const SCRIPT_SRC = IS_DEV
   ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
   : "script-src 'self' 'unsafe-inline'";
const CONNECT_SRC = IS_DEV ? "connect-src 'self' ws:" : "connect-src 'self'";

// ----- Headers applied to every route.
const SECURITY_HEADERS = [
   { key: 'X-Content-Type-Options', value: 'nosniff' },
   { key: 'X-Frame-Options', value: 'DENY' },
   { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
   {
      key: 'Permissions-Policy',
      value: 'camera=(self), microphone=(), geolocation=()',
   },
   {
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
   },
   {
      key: 'Content-Security-Policy',
      value: [
         "default-src 'self'",
         "img-src 'self' data: blob:",
         "style-src 'self' 'unsafe-inline'",
         SCRIPT_SRC,
         "font-src 'self' data:",
         CONNECT_SRC,
         "frame-ancestors 'none'",
         "base-uri 'self'",
         "form-action 'self'",
      ].join('; '),
   },
];

const nextConfig: NextConfig = {
   output: 'standalone',
   poweredByHeader: false,
   reactStrictMode: true,
   agentRules: false,
   experimental: {
      serverActions: { bodySizeLimit: '2mb' },
   },
   async headers() {
      return [{ source: '/:path*', headers: SECURITY_HEADERS }];
   },
};

export default nextConfig;
