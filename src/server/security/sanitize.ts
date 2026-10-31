import { AppError } from "@/lib/errors";

/**
 * Sanitizes errors returned to clients to prevent Information Disclosure (CWE-209).
 * Strips raw database queries, stack traces, internal paths, and credentials.
 */
export function sanitizeClientError(error: unknown): {
  message: string;
  code: string;
  statusCode: number;
} {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  const rawMessage = error instanceof Error ? error.message : String(error);

  // Check for internal database syntax or connection leak
  if (
    rawMessage.includes("prisma") ||
    rawMessage.includes("Invalid `prisma.") ||
    rawMessage.includes("database") ||
    rawMessage.includes("ECONNREFUSED") ||
    rawMessage.includes("foreign key constraint") ||
    rawMessage.includes("unique constraint") ||
    rawMessage.includes("SELECT") ||
    rawMessage.includes("INSERT") ||
    rawMessage.includes("UPDATE")
  ) {
    return {
      message: "An internal database error occurred. Please try again later.",
      code: "DATABASE_ERROR",
      statusCode: 500,
    };
  }

  // Check for SMTP or auth credential leak
  if (
    rawMessage.includes("SMTP") ||
    rawMessage.includes("password") ||
    rawMessage.includes("token") ||
    rawMessage.includes("transporter") ||
    rawMessage.includes("AUTH")
  ) {
    return {
      message: "A communication or authentication error occurred.",
      code: "COMMUNICATION_ERROR",
      statusCode: 500,
    };
  }

  // Generic sanitized fallback
  return {
    message: "An unexpected error occurred. Please contact support if this persists.",
    code: "INTERNAL_SERVER_ERROR",
    statusCode: 500,
  };
}

/**
 * Strips control characters, null bytes, and trims strings
 */
export function sanitizeInputString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\0/g, "") // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars except newline/tab
    .trim();
}

