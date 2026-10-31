import { AppError } from "@/lib/errors";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding window rate limiter.
 *
 * NOTE ON SERVERLESS ENVIRONMENTS:
 * In-memory state is maintained per server process/container instance.
 * In distributed or multi-region serverless deployments (such as Vercel Edge/Serverless Lambdas),
 * rate limits are enforced within each isolated instance. For globally synchronized rate limiting
 * across ephemeral lambdas, Redis (e.g. Upstash Redis) or a DB-backed atomic counter table should be used.
 * For this application and single-region deployments, this provides immediate brute-force defense.
 */
class RateLimiter {
  private store = new Map<string, RateLimitRecord>();

  /**
   * Cleans up expired entries periodically to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (record.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Checks whether the given key has exceeded the limit.
   * Throws AppError(429) if limit exceeded.
   */
  check(key: string, maxAttempts: number, windowSeconds: number): { remaining: number; resetIn: number } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // Trigger cleanup periodically
    if (this.store.size > 1000) {
      this.cleanup();
    }

    const record = this.store.get(key);

    if (!record || record.resetAt <= now) {
      this.store.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return { remaining: maxAttempts - 1, resetIn: windowSeconds };
    }

    if (record.count >= maxAttempts) {
      const waitSeconds = Math.ceil((record.resetAt - now) / 1000);
      throw new AppError(
        `Too many requests. Please try again in ${waitSeconds} seconds.`,
        "FORBIDDEN",
        429,
        [{ code: "RATE_LIMITED", message: `Exceeded ${maxAttempts} attempts per ${windowSeconds}s` }]
      );
    }

    record.count += 1;
    return {
      remaining: maxAttempts - record.count,
      resetIn: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Rate limit login: Max 5 attempts per 15 minutes per identifier (IP or email)
 */
export function checkLoginRateLimit(identifier: string) {
  return rateLimiter.check(`login:${identifier}`, 5, 15 * 60);
}

/**
 * Rate limit password reset: Max 3 requests per 15 minutes per email
 */
export function checkPasswordResetRateLimit(email: string) {
  return rateLimiter.check(`forgot-pw:${email}`, 3, 15 * 60);
}

