import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const SECURE_COOKIE_OPTIONS: Partial<ResponseCookie> = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 days
};

export function getSecureCookieOptions(maxAgeSeconds?: number): Partial<ResponseCookie> {
  return {
    ...SECURE_COOKIE_OPTIONS,
    ...(maxAgeSeconds !== undefined ? { maxAge: maxAgeSeconds } : {}),
  };
}

