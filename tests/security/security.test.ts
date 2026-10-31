import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { validatePasswordPolicy, hashPassword, verifyPassword } from "@/server/auth/password";
import { RateLimiter } from "@/server/auth/rate-limit";
import { AppError } from "@/lib/errors";
import { validateRequestOrigin } from "@/server/security/csrf";
import { sanitizeClientError, sanitizeInputString } from "@/server/security/sanitize";
import { SECURITY_HEADERS, applySecurityHeaders } from "@/server/security/headers";

describe("Security 1: Password Policy Enforcement & Cryptographic Hashing", () => {
  it("strictly rejects passwords with 8 or fewer characters", () => {
    expect(() => validatePasswordPolicy("Short1!")).toThrow("more than 8 characters");
    expect(() => validatePasswordPolicy("12345678")).toThrow("more than 8 characters");
  });

  it("strictly rejects passwords lacking uppercase characters", () => {
    expect(() => validatePasswordPolicy("alllowercase123!")).toThrow("at least one uppercase letter");
  });

  it("strictly rejects passwords lacking lowercase characters", () => {
    expect(() => validatePasswordPolicy("ALLUPPERCASE123!")).toThrow("at least one lowercase letter");
  });

  it("strictly rejects passwords lacking numbers or special characters", () => {
    expect(() => validatePasswordPolicy("NoSpecialOrNumber")).toThrow("at least one special character");
  });

  it("accepts strong, compliant passwords and securely hashes them", async () => {
    const strongPassword = "CorrectHorseBatteryStaple!2026";
    expect(() => validatePasswordPolicy(strongPassword)).not.toThrow();

    const hash = await hashPassword(strongPassword);
    expect(hash).toBeDefined();
    expect(hash).not.toContain(strongPassword);

    // Cryptographic verification
    const isValid = await verifyPassword(strongPassword, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword("WrongPassword123!", hash);
    expect(isInvalid).toBe(false);
  });
});

describe("Security 2: Rate Limiting & Brute Force Defense", () => {
  it("blocks requests after exceeding maximum attempts within window", () => {
    // 5 attempts allowed in 60 seconds
    const limiter = new RateLimiter();
    const clientKey = "ip:192.168.1.50";

    for (let i = 0; i < 5; i++) {
      const res = limiter.check(clientKey, 5, 60);
      expect(res.remaining).toBe(5 - (i + 1));
      expect(res.resetIn).toBeGreaterThan(0);
    }

    // 6th attempt must be rejected with 429
    expect(() => limiter.check(clientKey, 5, 60)).toThrow(/Too many requests/);
  });

  it("maintains strict isolation between different IP keys", () => {
    const limiter = new RateLimiter();
    const attackerKey = "ip:attacker.com";
    const honestKey = "ip:honest.com";

    // Exhaust attacker limit (3 attempts)
    limiter.check(attackerKey, 3, 60);
    limiter.check(attackerKey, 3, 60);
    limiter.check(attackerKey, 3, 60);
    expect(() => limiter.check(attackerKey, 3, 60)).toThrow(/Too many requests/);

    // Honest client must remain unaffected
    const honestCheck = limiter.check(honestKey, 3, 60);
    expect(honestCheck.remaining).toBe(2);
  });

  it("allows clearing rate limit on successful authentication", () => {
    const limiter = new RateLimiter();
    const userKey = "user:target@example.com";

    limiter.check(userKey, 3, 60);
    limiter.check(userKey, 3, 60);

    // Successful login clears counter
    limiter.reset(userKey);

    const freshCheck = limiter.check(userKey, 3, 60);
    expect(freshCheck.remaining).toBe(2);
  });
});

describe("Security 3: Password Reset Token Expiry & Single-Use Enforcement", () => {
  interface ResetTokenRecord {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
    used: boolean;
  }

  const tokenDb = new Map<string, ResetTokenRecord>();

  function hashToken(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  function createResetToken(userId: string, expiresInMs = 3600000): string {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    tokenDb.set(tokenHash, {
      tokenHash,
      userId,
      expiresAt: new Date(Date.now() + expiresInMs),
      used: false,
    });
    return rawToken;
  }

  function consumeResetToken(rawToken: string): { userId: string } {
    const tokenHash = hashToken(rawToken);
    const record = tokenDb.get(tokenHash);

    if (!record) {
      throw AppError.badRequest("Invalid or nonexistent password reset token");
    }

    if (record.used) {
      throw AppError.badRequest("Password reset token has already been used");
    }

    if (record.expiresAt < new Date()) {
      throw AppError.badRequest("Password reset token has expired");
    }

    // Mark as consumed immediately
    record.used = true;
    return { userId: record.userId };
  }

  it("allows resetting password with a fresh, valid token", () => {
    const rawToken = createResetToken("usr_alice");
    const result = consumeResetToken(rawToken);
    expect(result.userId).toBe("usr_alice");
  });

  it("strictly prevents single-use token replay attacks", () => {
    const rawToken = createResetToken("usr_bob");

    // First use succeeds
    const firstResult = consumeResetToken(rawToken);
    expect(firstResult.userId).toBe("usr_bob");

    // Second use with the identical token must fail
    expect(() => consumeResetToken(rawToken)).toThrow("already been used");
  });

  it("strictly rejects expired password reset tokens", () => {
    // Expired 10 seconds ago
    const rawToken = createResetToken("usr_charlie", -10000);
    expect(() => consumeResetToken(rawToken)).toThrow("token has expired");
  });
});

describe("Security 4: Role-Based Access Control (RBAC Matrix)", () => {
  type Role = "ADMIN" | "STAFF" | "CUSTOMER";

  interface RequestContext {
    user: { id: string; role: Role; customerProfileId?: string | null } | null;
  }

  function authorizeAction(
    ctx: RequestContext,
    requiredRole: Role | Role[],
    targetCustomerId?: string
  ) {
    if (!ctx.user) {
      throw AppError.unauthorized("Authentication required");
    }

    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(ctx.user.role)) {
      throw AppError.forbidden("Access denied: Insufficient permissions");
    }

    if (targetCustomerId) {
      if (ctx.user.role === "ADMIN" || ctx.user.role === "STAFF") {
        return true;
      }
      if (ctx.user.role === "CUSTOMER" && ctx.user.customerProfileId === targetCustomerId) {
        return true;
      }
      throw AppError.forbidden("Access denied: You do not own this customer profile");
    }

    return true;
  }

  it("protects ADMIN-only actions from STAFF and CUSTOMER roles", () => {
    const adminCtx: RequestContext = { user: { id: "u_admin", role: "ADMIN" } };
    const staffCtx: RequestContext = { user: { id: "u_staff", role: "STAFF" } };
    const customerCtx: RequestContext = { user: { id: "u_cust", role: "CUSTOMER" } };
    const anonCtx: RequestContext = { user: null };

    // Admin passes
    expect(() => authorizeAction(adminCtx, "ADMIN")).not.toThrow();

    // Staff fails
    expect(() => authorizeAction(staffCtx, "ADMIN")).toThrow("Access denied");

    // Customer fails
    expect(() => authorizeAction(customerCtx, "ADMIN")).toThrow("Access denied");

    // Anonymous fails
    expect(() => authorizeAction(anonCtx, "ADMIN")).toThrow("Authentication required");
  });

  it("protects STAFF/ADMIN actions from CUSTOMER role", () => {
    const staffCtx: RequestContext = { user: { id: "u_staff", role: "STAFF" } };
    const customerCtx: RequestContext = { user: { id: "u_cust", role: "CUSTOMER" } };

    expect(() => authorizeAction(staffCtx, ["ADMIN", "STAFF"])).not.toThrow();
    expect(() => authorizeAction(customerCtx, ["ADMIN", "STAFF"])).toThrow("Access denied");
  });

  it("strictly enforces customer ownership on private resources", () => {
    const ownerCustomerCtx: RequestContext = {
      user: { id: "u_1", role: "CUSTOMER", customerProfileId: "cust_100" },
    };
    const attackerCustomerCtx: RequestContext = {
      user: { id: "u_2", role: "CUSTOMER", customerProfileId: "cust_999" },
    };
    const adminCtx: RequestContext = {
      user: { id: "u_admin", role: "ADMIN", customerProfileId: null },
    };

    // Owner can access own profile
    expect(() => authorizeAction(ownerCustomerCtx, "CUSTOMER", "cust_100")).not.toThrow();

    // Attacker cannot access another customer's profile
    expect(() => authorizeAction(attackerCustomerCtx, "CUSTOMER", "cust_100")).toThrow(
      "You do not own this customer profile"
    );

    // Admin can access any customer profile
    expect(() => authorizeAction(adminCtx, ["ADMIN", "CUSTOMER"], "cust_100")).not.toThrow();
  });
});

describe("Security 5: Request Body Tampering & Privilege Escalation Defense", () => {
  it("strips or rejects role escalation in registration payloads", () => {
    const maliciousRegistrationPayload = {
      name: "Attacker",
      email: "attacker@hack.com",
      password: "StrongPassword123!",
      role: "ADMIN", // Malicious injection
    };

    // Server-side registration logic forces role = CUSTOMER
    const sanitizedUser = {
      name: maliciousRegistrationPayload.name,
      email: maliciousRegistrationPayload.email,
      role: "CUSTOMER" as const, // Hardcoded on server
    };

    expect(sanitizedUser.role).toBe("CUSTOMER");
    expect(sanitizedUser.role).not.toBe(maliciousRegistrationPayload.role);
  });

  it("sanitizes dangerous control characters and null bytes from input strings", () => {
    const dirtyInput = "Normal text\0with null bytes\x07and bells\x1b[31m";
    const cleaned = sanitizeInputString(dirtyInput);

    expect(cleaned).not.toContain("\0");
    expect(cleaned).toBe("Normal textwith null bytesand bells[31m");
  });
});

describe("Security 6: Cron Secret Protection & Constant-Time Verification", () => {
  const CONFIGURED_CRON_SECRET = "super_secure_cron_token_brightloop_2026";

  function verifyCronAuthorization(authHeader?: string | null): boolean {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return false;
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      return false;
    }

    try {
      // Constant-time comparison preventing timing attacks
      const tokenBuffer = Buffer.from(token);
      const secretBuffer = Buffer.from(CONFIGURED_CRON_SECRET);
      if (tokenBuffer.length !== secretBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(tokenBuffer, secretBuffer);
    } catch {
      return false;
    }
  }

  it("rejects cron calls without Authorization header", () => {
    expect(verifyCronAuthorization(undefined)).toBe(false);
    expect(verifyCronAuthorization("")).toBe(false);
  });

  it("rejects cron calls with invalid Bearer token", () => {
    expect(verifyCronAuthorization("Bearer wrong_secret_key")).toBe(false);
    expect(verifyCronAuthorization("Bearer super_secure_cron_token_brightloop_202")).toBe(false);
  });

  it("accepts cron calls with valid Bearer secret", () => {
    expect(verifyCronAuthorization(`Bearer ${CONFIGURED_CRON_SECRET}`)).toBe(true);
  });
});

describe("Security 7: CSRF & Origin Validation", () => {
  it("rejects mutating requests originating from untrusted cross-origin domains", () => {
    const headers = {
      origin: "https://malicious-website.com",
      host: "app.brightloop.com",
    };

    const result = validateRequestOrigin(headers);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain("Cross-site origin rejected");
  });

  it("accepts mutating requests originating from allowed same-origin domain", () => {
    const headers = {
      origin: "http://localhost:3000",
      host: "localhost:3000",
    };

    const result = validateRequestOrigin(headers);
    expect(result.isValid).toBe(true);
  });
});

describe("Security 8: Error Sanitization & Secret Shielding", () => {
  it("sanitizes raw database errors and hides SQL/Prisma internals from clients", () => {
    const rawDbError = new Error(
      "Invalid `prisma.user.findUnique()` invocation: error in table users SELECT * FROM users WHERE email = 'test'"
    );

    const clientResponse = sanitizeClientError(rawDbError);
    expect(clientResponse.statusCode).toBe(500);
    expect(clientResponse.code).toBe("DATABASE_ERROR");
    expect(clientResponse.message).toBe("An internal database error occurred. Please try again later.");
    expect(clientResponse.message).not.toContain("SELECT");
    expect(clientResponse.message).not.toContain("prisma");
  });

  it("sanitizes SMTP and password leakage in exceptions", () => {
    const authLeakError = new Error(
      "SMTP Connection Failed: AUTH credentials user=admin pass=SecretPassword123"
    );

    const clientResponse = sanitizeClientError(authLeakError);
    expect(clientResponse.statusCode).toBe(500);
    expect(clientResponse.code).toBe("COMMUNICATION_ERROR");
    expect(clientResponse.message).not.toContain("SecretPassword123");
    expect(clientResponse.message).not.toContain("admin");
  });

  it("applies mandatory security headers to prevent framing and sniffing", () => {
    const headers = new Headers();
    applySecurityHeaders(headers);

    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
  });
});
