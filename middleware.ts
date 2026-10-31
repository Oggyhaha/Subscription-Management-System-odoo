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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET || "fallback-secret-for-middleware-validation";

  const session = sessionCookie ? await verifyTokenEdge(sessionCookie, secret) : null;

  // 1. Auth routes redirect if already signed in
  if (pathname === "/login" || pathname === "/register") {
    if (session) {
      return NextResponse.redirect(new URL(getDashboardForRole(session.role), request.url));
    }
    return NextResponse.next();
  }

  // 2. Admin routes (/admin/*)
  if (pathname.startsWith("/admin")) {
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (session.role !== "ADMIN") {
      // Forbidden: redirect to user's assigned dashboard
      return NextResponse.redirect(new URL(getDashboardForRole(session.role), request.url));
    }
    return NextResponse.next();
  }

  // 3. Staff routes (/staff/*)
  if (pathname.startsWith("/staff")) {
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (session.role !== "STAFF" && session.role !== "ADMIN") {
      return NextResponse.redirect(new URL(getDashboardForRole(session.role), request.url));
    }
    return NextResponse.next();
  }

  // 4. Customer routes (/customer/*)
  if (pathname.startsWith("/customer")) {
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/staff/:path*",
    "/customer/:path*",
    "/login",
    "/register",
  ],
};

