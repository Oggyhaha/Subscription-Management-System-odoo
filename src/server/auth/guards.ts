import { AppError } from "@/lib/errors";
import { getSessionPayload } from "./session";

export type Role = "ADMIN" | "STAFF" | "CUSTOMER";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  customerProfileId?: string | null;
  name: string;
}

export interface Session {
  user: SessionUser;
}

/**
 * Returns current authenticated session or null.
 */
export async function getSession(): Promise<Session | null> {
  const payload = await getSessionPayload();
  if (!payload) {
    return null;
  }

  return {
    user: {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      customerProfileId: payload.customerProfileId || null,
      name: payload.name,
    },
  };
}

/**
 * Ensures user is authenticated, throws UNAUTHORIZED if not.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session?.user) {
    throw AppError.unauthorized("Authentication required to access this resource");
  }
  return session.user;
}

/**
 * Ensures user is authenticated and possesses one of the allowed roles.
 */
export async function requireRole(allowedRoles: Role | Role[]): Promise<SessionUser> {
  const user = await requireUser();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(user.role)) {
    throw AppError.forbidden(`Access denied: Requires one of roles: ${roles.join(", ")}`);
  }

  return user;
}

/**
 * Ensures user owns the customer profile or is internal staff/admin.
 */
export async function requireCustomerOwnership(targetCustomerId: string): Promise<SessionUser> {
  const user = await requireUser();

  if (user.role === "ADMIN" || user.role === "STAFF") {
    return user;
  }

  if (user.role === "CUSTOMER" && user.customerProfileId === targetCustomerId) {
    return user;
  }

  throw AppError.forbidden("Access denied: You do not own this customer profile");
}
