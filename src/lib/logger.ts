type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "auth_secret",
  "cron_secret",
  "authorization",
  "cookie",
  "creditcard",
  "cardnumber",
  "cvv",
  "smtp_pass",
]);

/**
 * Deeply redacts sensitive keys from objects before logging
 */
export function redactSecrets(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(redactSecrets);
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = Array.from(SENSITIVE_KEYS).some((s) => lowerKey.includes(s));

    if (isSensitive) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSecrets(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

class Logger {
  private format(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const entry: Record<string, unknown> = {
      timestamp,
      level: level.toUpperCase(),
      message,
    };

    if (context) {
      entry.context = redactSecrets(context);
    }

    return JSON.stringify(entry);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== "production") {
      console.debug(this.format("debug", message, context));
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.info(this.format("info", message, context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(this.format("warn", message, context));
  }

  error(message: string, context?: Record<string, unknown>, error?: unknown): void {
    const errObj = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;

    const merged = {
      ...(context || {}),
      ...(errObj ? { error: errObj } : {}),
    };

    console.error(this.format("error", message, merged));
  }
}

export const logger = new Logger();
