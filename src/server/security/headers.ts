/**
 * Security Headers Configuration for Next.js and Middleware
 * Implements Defense-in-Depth against Clickjacking, MIME-sniffing, XSS, and Information Leakage.
 */

export interface SecurityHeader {
  key: string;
  value: string;
}

export const SECURITY_HEADERS: SecurityHeader[] = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js hydration and script chunks
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

export function applySecurityHeaders(headers: Headers): Headers {
  for (const h of SECURITY_HEADERS) {
    if (!headers.has(h.key)) {
      headers.set(h.key, h.value);
    }
  }
  return headers;
}

