export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "INSUFFICIENT_FUNDS"
  | "INVALID_STATE_TRANSITION"
  | "DISCOUNT_EXPIRED"
  | "DISCOUNT_LIMIT_REACHED"
  | "INTERNAL_SERVER_ERROR";

export interface ErrorDetails {
  field?: string;
  code?: string;
  message: string;
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails[];

  constructor(
    message: string,
    code: ErrorCode = "INTERNAL_SERVER_ERROR",
    statusCode = 500,
    details?: ErrorDetails[]
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  static badRequest(message: string, details?: ErrorDetails[]): AppError {
    return new AppError(message, "VALIDATION_ERROR", 400, details);
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError(message, "UNAUTHORIZED", 401);
  }

  static forbidden(message = "Access denied"): AppError {
    return new AppError(message, "FORBIDDEN", 403);
  }

  static notFound(resource = "Resource"): AppError {
    return new AppError(`${resource} not found`, "NOT_FOUND", 404);
  }

  static conflict(message: string): AppError {
    return new AppError(message, "CONFLICT", 409);
  }

  static invalidTransition(fromState: string, toState: string): AppError {
    return new AppError(
      `Invalid state transition from ${fromState} to ${toState}`,
      "INVALID_STATE_TRANSITION",
      422
    );
  }

  static internal(message = "An unexpected error occurred"): AppError {
    return new AppError(message, "INTERNAL_SERVER_ERROR", 500);
  }
}

