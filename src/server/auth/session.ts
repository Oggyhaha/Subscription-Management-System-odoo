import { cookies } from "next/headers";
import { createSessionToken, verifySessionToken, type SessionTokenPayload } from "./crypto";

export const SESSION_COOKIE_NAME = "brightloop_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function setSessionCookie(payload: Omit<SessionTokenPayload, "exp" | "iat">): Promise<string> {
  const token = createSessionToken(payload, SESSION_MAX_AGE_SECONDS);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return token;
}

export async function getSessionPayload(): Promise<SessionTokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

