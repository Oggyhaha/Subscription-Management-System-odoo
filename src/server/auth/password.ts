import bcrypt from "bcryptjs";
import { AppError } from "@/lib/errors";

const SALT_ROUNDS = 12;

/**
 * Strictly verifies password against Brightloop Software policy:
 * - More than 8 characters (>= 9)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one special character
 */
export function validatePasswordPolicy(password: string): void {
  if (!password || password.length <= 8) {
    throw AppError.badRequest("Password must be more than 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    throw AppError.badRequest("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    throw AppError.badRequest("Password must contain at least one lowercase letter");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw AppError.badRequest("Password must contain at least one special character");
  }
}

/**
 * Hashes a plaintext password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  validatePasswordPolicy(password);
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares plaintext password with stored hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

