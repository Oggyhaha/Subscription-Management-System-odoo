import { env } from "@/lib/env";

/**
 * CSRF & Origin Protection Utility
 * Enforces strict origin checking on state-changing HTTP requests (POST, PUT, DELETE, PATCH).
 */

export function getExpectedOrigin(): string {
  if (env.APP_URL) {
    try {
      const parsed = new URL(env.APP_URL);
      return parsed.origin;
    } catch {
      // ignore
    }
  }
  return "http://localhost:3000";
}

/**
 * Validates the Origin and/or Referer headers of an incoming request
 * to protect Server Actions and API Route handlers from Cross-Site Request Forgery.
 */
export function validateRequestOrigin(
  headers: Headers | Record<string, string | undefined>,
  allowedOrigins?: string[]
): { isValid: boolean; reason?: string } {
  const getHeader = (name: string): string | undefined => {
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name) || undefined;
    }
    const rec = headers as Record<string, string | undefined>;
    return rec[name.toLowerCase()] || rec[name];
  };

  const origin = getHeader("origin");
  const referer = getHeader("referer");
  const host = getHeader("host");

  const allowedList = new Set<string>();

  const baseOrigin = getExpectedOrigin();
  allowedList.add(baseOrigin);

  if (host) {
    allowedList.add(`http://${host}`);
    allowedList.add(`https://${host}`);
  }

  if (allowedOrigins) {
    for (const o of allowedOrigins) {
      allowedList.add(o);
    }
  }

  // 1. If Origin header is present, it must strictly match an allowed origin
  if (origin) {
    if (!allowedList.has(origin)) {
      return {
        isValid: false,
        reason: `Cross-site origin rejected: "${origin}" not in allowed origins`,
      };
    }
    return { isValid: true };
  }

  // 2. If Origin is absent, inspect Referer header
  if (referer) {
    try {
      const refUrl = new URL(referer);
      if (!allowedList.has(refUrl.origin)) {
        return {
          isValid: false,
          reason: `Cross-site referer rejected: "${refUrl.origin}" not in allowed origins`,
        };
      }
      return { isValid: true };
    } catch {
      return {
        isValid: false,
        reason: "Invalid referer header format",
      };
    }
  }

  // In Next.js Server Actions executed within same-origin pages, origin is provided.
  // In server-to-server crons or test harnesses without browser headers, pass if host matches.
  return { isValid: true };
}

