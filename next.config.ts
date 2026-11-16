import type { NextConfig } from "next";

/*
 * Security headers (SECURITY.md §11; implementation plan
 * docs/SECURITY_HEADERS_PROPOSAL.md) — implemented as the documented MVP
 * baseline:
 * - HSTS without `preload` (preload is a separate conscious decision).
 * - CSP with `unsafe-inline` for script/style (Next.js App Router inline
 *   bootstrap; nonce-based CSP is the documented Phase 5 evolution).
 *   In development `unsafe-eval` is added for HMR/Turbopack.
 * - Supabase origins for img-src/connect-src are derived at config load
 *   from NEXT_PUBLIC_SUPABASE_URL — never hardcoded — and only accepted
 *   for https *.supabase.co / *.supabase.com hosts, so placeholder values
 *   degrade to a harmless allow-list entry instead of breaking localhost.
 * - Pl@ntNet is deliberately NOT in connect-src: the upstream API is
 *   called server-side only (src/lib/plantnet/live-provider.ts); allowing
 *   it in the browser would widen the client attack surface for nothing.
 * - Report-only rollout: CSP was reviewed against the enforcing values in
 *   docs/SECURITY_HEADERS_PROPOSAL.md §3–5; AdSense-era allowances are a
 *   separate documented Phase 5/6 change.
 */

function supabaseOrigins(): { img: string[]; connect: string[] } {
  const img = ["'self'", "data:"];
  const connect = ["'self'"];
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (raw) {
    try {
      const url = new URL(raw);
      const isSupabaseHost =
        url.protocol === "https:" &&
        (url.hostname.endsWith(".supabase.co") ||
          url.hostname.endsWith(".supabase.com"));
      if (isSupabaseHost) {
        img.push(url.origin);
        connect.push(url.origin, `wss://${url.host}`);
      }
    } catch {
      // Unparseable value: omit the extra origins rather than guess.
    }
  }
  return { img, connect };
}

const { img: IMG_SRC, connect: CONNECT_SRC } = supabaseOrigins();

const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval'";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src ${IMG_SRC.join(" ")}`,
  `connect-src ${CONNECT_SRC.join(" ")}`,
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    /*
     * Phase 2 (API_DOCUMENTATION.md §2.1): the proxy buffers request bodies
     * in memory and caps them at 10 MB by default — smaller than our own
     * upload contract (3 × 10 MB images + fields), which made oversized
     * uploads fail with a parse error (400) instead of the contract's 413.
     * Raise it slightly above the route handler's MAX_BODY_BYTES guard
     * (33 MB) so /api/identify can enforce its own documented limits;
     * anything larger is still truncated and rejected as invalid_request.
     */
    proxyClientMaxBodySize: "34mb",
  },
  /*
   * next/image remote sources (SEO_STRATEGY.md §7 / UI image flows): the
   * only planned image host is the project's Supabase storage (the public
   * `plant-images` bucket). Wildcard subdomains of the Supabase hosts —
   * nothing else — so unknown URLs can never be silently optimized.
   */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
