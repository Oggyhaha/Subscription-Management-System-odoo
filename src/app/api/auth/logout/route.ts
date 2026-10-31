import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth/session";

export async function POST(request: Request) {
  await clearSessionCookie();
  const accept = request.headers.get("accept");
  if (accept && accept.includes("application/json")) {
    return NextResponse.json({ success: true, message: "Logged out" });
  }
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}

export async function GET(request: Request) {
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
