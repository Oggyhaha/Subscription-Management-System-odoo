import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "brightloop_session";

interface SessionPayload {
  userId: string;
  email: string;
  role: "ADMIN" | "STAFF" | "CUSTOMER";
  customerProfileId?: string | null;
  name: string;
  exp: number;
}

/**
 * Fast Web-Crypto verification for Edge / Middleware runtime
 */
async function verifyTokenEdge(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, bodyB64, sigB64] = parts;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Convert base64url to Uint8Array
    const sigStr = sigB64.replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (sigStr.length % 4)) % 4;
    const paddedSig = sigStr + "=".repeat(pad);
    const sigBytes = Uint8Array.from(atob(paddedSig), (c) => c.charCodeAt(0));

    const data = encoder.encode(`${headerB64}.${bodyB64}`);
    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, data);

    if (!isValid) return null;

    // Decode body
    const bodyStr = bodyB64.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBody = bodyStr + "=".repeat((4 - (bodyStr.length % 4)) % 4);
    const payload: SessionPayload = JSON.parse(atob(paddedBody));

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

function getDashboardForRole(role: "ADMIN" | "STAFF" | "CUSTOMER"): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "STAFF":
      return "/staff";
    case "CUSTOMER":
      return "/customer";
  }
}

/**
 * Verifies cross-origin safety for mutating HTTP methods (POST, PUT, DELETE, PATCH)
 */
function isAllowedMutationOrigin(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    return true;
  }

  // Exempt cron endpoints (authenticated via Bearer CRON_SECRET)
  if (request.nextUrl.pathname.startsWith("/api/cron/")) {
    return true;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  const allowed = new Set<string>();
  if (host) {
    allowed.add(`http://${host}`);
    allowed.add(`https://${host}`);
  }
  if (process.env.APP_URL) {
    try {
      allowed.add(new URL(process.env.APP_URL).origin);
    } catch {
      // ignore
    }
  }
  allowed.add("http://localhost:3000");

  if (origin && !allowed.has(origin)) {
    return false;
  }

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!allowed.has(refOrigin)) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. CSRF / Origin Check for Mutations
  if (!isAllowedMutationOrigin(request)) {
    return new NextResponse(
      JSON.stringify({ error: "Forbidden: Cross-origin request rejected" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET || "fallback-secret-for-middleware-validation";

  const session = sessionCookie ? await verifyTokenEdge(sessionCookie, secret) : null;

  let response: NextResponse | null = null;

  // 2. Auth routes redirect if already signed in
  if (pathname === "/login" || pathname === "/register") {
    if (session) {
      response = NextResponse.redirect(new URL(getDashboardForRole(session.role), request.url));
    } else {
      response = NextResponse.next();
    }
  }
  // 3. Admin routes (/admin/*)
  else if (pathname.startsWith("/admin")) {
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      response = NextResponse.redirect(loginUrl);
    } else if (session.role !== "ADMIN") {
      // Forbidden: redirect to user's assigned dashboard
      response = NextResponse.redirect(new URL(getDashboardForRole(session.role), request.url));
    } else {
      response = NextResponse.next();
    }
  }
  // 4. Staff routes (/staff/*)
  else if (pathname.startsWith("/staff")) {
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      response = NextResponse.redirect(loginUrl);
    } else if (session.role !== "STAFF" && session.role !== "ADMIN") {
      response = NextResponse.redirect(new URL(getDashboardForRole(session.role), request.url));
    } else {
      response = NextResponse.next();
    }
  }
  // 5. Customer routes (/customer/*)
  else if (pathname.startsWith("/customer")) {
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      response = NextResponse.redirect(loginUrl);
    } else {
      response = NextResponse.next();
    }
  } else {
    response = NextResponse.next();
  }

  // 6. Inject Security Headers on every response
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/staff/:path*",
    "/customer/:path*",
    "/login",
    "/register",
    "/api/:path*",
  ],
};
