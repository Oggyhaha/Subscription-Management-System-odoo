import { AppError } from "@/lib/errors";

export type Role = "ADMIN" | "STAFF" | "CUSTOMER";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  customerProfileId?: string | null;
}

export interface Session {
  user: SessionUser;
}

/**
 * Returns current authenticated session or null.
 * Stub for Dev B integration; full implementation in Hour 2.
 */
export async function getSession(): Promise<Session | null> {
  // TODO(dev-a): Implement full JWT/cookie session extraction in Hour 2
  return null;
}

/**
 * Ensures user is authenticated, throws UNAUTHORIZED if not.
 * Stub for Dev B integration; full implementation in Hour 2.
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
 * Stub for Dev B integration; full implementation in Hour 2.
 */
export async function requireRole(allowedRoles: Role | Role[]): Promise<SessionUser> {
  const user = await requireUser();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(user.role)) {
    throw AppError.forbidden(`Requires one of roles: ${roles.join(", ")}`);
  }

  return user;
}

/**
 * Ensures user owns the resource or is internal staff/admin.
 * Stub for Dev B integration; full implementation in Hour 2.
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

