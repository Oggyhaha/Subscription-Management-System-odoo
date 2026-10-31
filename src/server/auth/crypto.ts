import crypto from "crypto";
import { env } from "@/lib/env";

export interface SessionTokenPayload {
  userId: string;
  email: string;
  role: "ADMIN" | "STAFF" | "CUSTOMER";
  customerProfileId?: string | null;
  name: string;
  exp: number; // Unix timestamp in seconds
  iat: number; // Unix timestamp in seconds
}

/**
 * Creates an HMAC-SHA256 signature for a string using AUTH_SECRET
 */
function sign(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

/**
 * Encodes and signs a session payload into a compact token
 */
export function createSessionToken(
  payload: Omit<SessionTokenPayload, "exp" | "iat">,
  expiresInSeconds = 7 * 24 * 60 * 60 // 7 days default
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionTokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = sign(`${header}.${body}`, env.AUTH_SECRET);

  return `${header}.${body}.${signature}`;
}

/**
 * Verifies a token and returns the decoded payload if valid and not expired
 */
export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [header, body, signature] = parts;
    const expectedSignature = sign(`${header}.${body}`, env.AUTH_SECRET);

    // Timing-safe signature check
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload: SessionTokenPayload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf-8")
    );

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generates a cryptographically strong random token (for password reset, API keys)
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Hashes a token using SHA-256 for safe database storage
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

