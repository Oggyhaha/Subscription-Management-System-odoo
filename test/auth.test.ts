import { describe, it, expect } from "vitest";
import { validatePasswordPolicy, hashPassword, verifyPassword } from "../src/server/auth/password";
import {
  createSessionToken,
  verifySessionToken,
  generateRandomToken,
  hashToken,
} from "../src/server/auth/crypto";
import { rateLimiter } from "../src/server/auth/rate-limit";
import {
  passwordResetTemplate,
  invoiceDeliveryTemplate,
  quotationDeliveryTemplate,
} from "../src/server/services/email/templates";

describe("Password Security & Policy", () => {
  it("rejects passwords with 8 or fewer characters", () => {
    expect(() => validatePasswordPolicy("Ab1!efgh")).toThrow("more than 8 characters");
  });

  it("rejects passwords without uppercase letters", () => {
    expect(() => validatePasswordPolicy("lowercase123!@")).toThrow("at least one uppercase letter");
  });

  it("rejects passwords without lowercase letters", () => {
    expect(() => validatePasswordPolicy("UPPERCASE123!@")).toThrow("at least one lowercase letter");
  });

  it("rejects passwords without special characters", () => {
    expect(() => validatePasswordPolicy("ValidPassword123")).toThrow("at least one special character");
  });

  it("accepts and hashes compliant passwords", async () => {
    const valid = "CompliantPass123!";
    expect(() => validatePasswordPolicy(valid)).not.toThrow();

    const hash = await hashPassword(valid);
    expect(hash).toBeDefined();
    expect(await verifyPassword(valid, hash)).toBe(true);
    expect(await verifyPassword("WrongPassword123!", hash)).toBe(false);
  });
});

describe("Session & Token Cryptography", () => {
  it("creates and verifies valid session tokens", () => {
    const payload = {
      userId: "usr_123",
      email: "test@brightloop.com",
      role: "STAFF" as const,
      customerProfileId: null,
      name: "Staff Tester",
    };

    const token = createSessionToken(payload, 3600);
    expect(token).toBeDefined();

    const verified = verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe("usr_123");
    expect(verified?.role).toBe("STAFF");
  });

  it("rejects tampered session tokens", () => {
    const payload = {
      userId: "usr_123",
      email: "test@brightloop.com",
      role: "CUSTOMER" as const,
      customerProfileId: "cust_1",
      name: "Customer",
    };

    const token = createSessionToken(payload, 3600);
    const tampered = token.slice(0, -4) + "XXXX";
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("hashes single-use tokens deterministically with SHA-256", () => {
    const raw = generateRandomToken(32);
    expect(raw).toHaveLength(64); // 32 bytes in hex = 64 hex chars
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});

describe("Rate Limiter", () => {
  it("allows requests within limit and blocks when exceeded", () => {
    const key = `test_rate_limit_${Date.now()}`;
    const max = 3;
    const windowSec = 10;

    expect(rateLimiter.check(key, max, windowSec).remaining).toBe(2);
    expect(rateLimiter.check(key, max, windowSec).remaining).toBe(1);
    expect(rateLimiter.check(key, max, windowSec).remaining).toBe(0);

    // 4th attempt should throw 429
    expect(() => rateLimiter.check(key, max, windowSec)).toThrow("Too many requests");
  });
});

describe("Email Templates", () => {
  it("generates password reset email with valid link and recipient name", () => {
    const tpl = passwordResetTemplate("http://localhost:3000/reset-password?token=xyz123", "Sarah");
    expect(tpl.subject).toContain("Reset your Brightloop");
    expect(tpl.html).toContain("xyz123");
    expect(tpl.html).toContain("Sarah");
    expect(tpl.text).toContain("xyz123");
  });

  it("generates invoice email with payment details", () => {
    const tpl = invoiceDeliveryTemplate("INV-2026-001", "$500.00", "Nov 15, 2026", "http://localhost:3000/invoices/1", "Acme Corp");
    expect(tpl.subject).toContain("INV-2026-001");
    expect(tpl.html).toContain("$500.00");
    expect(tpl.html).toContain("Acme Corp");
  });
});

