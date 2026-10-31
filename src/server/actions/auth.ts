"use server";

import { revalidatePath } from "next/cache";
import { userService } from "@/server/services/user";
import { emailService, passwordResetTemplate, accountInvitationTemplate } from "@/server/services/email";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "@/server/auth/password";
import { generateRandomToken, hashToken } from "@/server/auth/crypto";
import { setSessionCookie, clearSessionCookie } from "@/server/auth/session";
import { requireRole, getSession } from "@/server/auth/guards";
import { checkLoginRateLimit, checkPasswordResetRateLimit } from "@/server/auth/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { env } from "@/lib/env";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createStaffSchema,
  type LoginInput,
  type RegisterInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type CreateStaffInput,
} from "@/schemas/auth";

export interface ActionResult<T = unknown> {
  success: boolean;
  error?: string;
  message?: string;
  redirectUrl?: string;
  data?: T;
}

function getRoleRedirect(role: "ADMIN" | "STAFF" | "CUSTOMER"): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "STAFF":
      return "/staff";
    case "CUSTOMER":
      return "/customer";
  }
}

/**
 * 1. Customer Registration Server Action
 * Creates User (CUSTOMER) + CustomerProfile atomically.
 */
export async function registerAction(input: RegisterInput): Promise<ActionResult> {
  try {
    const validated = registerSchema.parse(input);
    validatePasswordPolicy(validated.password);

    const passwordHash = await hashPassword(validated.password);
    const { user, customerProfile } = await userService.registerCustomer({
      name: validated.name,
      email: validated.email,
      passwordHash,
    });

    // Automatically establish session for the new customer
    await setSessionCookie({
      userId: user.id,
      email: user.email,
      role: "CUSTOMER",
      customerProfileId: customerProfile.id,
      name: user.name,
    });

    await writeAuditLog({
      userId: user.id,
      action: "USER_REGISTERED",
      entityType: "User",
      entityId: user.id,
      metadata: { role: "CUSTOMER", email: user.email },
    });

    return {
      success: true,
      redirectUrl: "/customer",
      message: "Account created successfully!",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return { success: false, error: message };
  }
}

/**
 * 2. User Login Server Action
 * Validates credentials, enforces rate limits, and establishes HTTP-only session.
 */
export async function loginAction(input: LoginInput): Promise<ActionResult> {
  try {
    const validated = loginSchema.parse(input);
    const email = validated.email.toLowerCase().trim();

    // Check sliding window rate limit (5 attempts per 15 min)
    checkLoginRateLimit(email);

    const user = await userService.findByEmail(email);
    if (!user) {
      return { success: false, error: "Invalid email or password" };
    }

    const isValid = await verifyPassword(validated.password, user.passwordHash);
    if (!isValid) {
      return { success: false, error: "Invalid email or password" };
    }

    // Set secure cookie session
    await setSessionCookie({
      userId: user.id,
      email: user.email,
      role: user.role,
      customerProfileId: user.customerProfile?.id || null,
      name: user.name,
    });

    await writeAuditLog({
      userId: user.id,
      action: "USER_LOGIN",
      entityType: "User",
      entityId: user.id,
      metadata: { role: user.role },
    });

    const redirectUrl = getRoleRedirect(user.role);
    return {
      success: true,
      redirectUrl,
      data: { id: user.id, email: user.email, role: user.role },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication failed";
    return { success: false, error: message };
  }
}

/**
 * 3. Logout Server Action
 * Clears session cookie and redirects to sign-in.
 */
export async function logoutAction(): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (session?.user) {
      await writeAuditLog({
        userId: session.user.id,
        action: "USER_LOGOUT",
        entityType: "User",
        entityId: session.user.id,
      });
    }

    await clearSessionCookie();
    return { success: true, redirectUrl: "/login" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Logout failed";
    return { success: false, error: message };
  }
}

/**
 * 4. Forgot Password Server Action
 * Always returns a generic response to prevent user enumeration attacks.
 */
export async function forgotPasswordAction(input: ForgotPasswordInput): Promise<ActionResult> {
  const genericSuccessMessage =
    "If an account exists with this email address, a password reset link has been dispatched to your inbox.";

  try {
    const validated = forgotPasswordSchema.parse(input);
    const email = validated.email.toLowerCase().trim();

    // Enforce rate limiting
    checkPasswordResetRateLimit(email);

    const user = await userService.findByEmail(email);
    if (user) {
      const rawToken = generateRandomToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await userService.setResetToken(user.id, tokenHash, expiresAt);

      const resetUrl = `${env.APP_URL}/reset-password?token=${rawToken}`;
      const template = passwordResetTemplate(resetUrl, user.name);

      await emailService.sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        userId: user.id,
      });

      await writeAuditLog({
        userId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        entityType: "User",
        entityId: user.id,
      });
    }

    return { success: true, message: genericSuccessMessage };
  } catch (err: unknown) {
    // If rate-limited specifically, surface message; otherwise always return generic message
    const isRateLimit = err instanceof Error && err.message.includes("Too many requests");
    if (isRateLimit) {
      return { success: false, error: (err as Error).message };
    }
    return { success: true, message: genericSuccessMessage };
  }
}

/**
 * 5. Reset Password Server Action
 * Consumes single-use token and updates password.
 */
export async function resetPasswordAction(input: ResetPasswordInput): Promise<ActionResult> {
  try {
    const validated = resetPasswordSchema.parse(input);
    validatePasswordPolicy(validated.password);

    const tokenHash = hashToken(validated.token);
    const user = await userService.findByValidResetToken(tokenHash);

    if (!user) {
      return {
        success: false,
        error: "This password reset token is invalid or has expired. Please request a new link.",
      };
    }

    const passwordHash = await hashPassword(validated.password);
    await userService.updatePasswordAndClearResetToken(user.id, passwordHash);

    await writeAuditLog({
      userId: user.id,
      action: "PASSWORD_RESET_COMPLETED",
      entityType: "User",
      entityId: user.id,
    });

    return {
      success: true,
      message: "Your password has been reset successfully. You may now log in.",
      redirectUrl: "/login",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Password reset failed";
    return { success: false, error: message };
  }
}

/**
 * 6. Create Staff Account Server Action
 * ADMIN role ONLY. Creates internal staff account and sends invitation email.
 */
export async function createStaffAccountAction(input: CreateStaffInput): Promise<ActionResult> {
  try {
    const adminUser = await requireRole("ADMIN");
    const validated = createStaffSchema.parse(input);

    // If password omitted by admin, generate secure compliant password
    const rawPassword = validated.password || `BrightStaff#${generateRandomToken(4)}!`;
    validatePasswordPolicy(rawPassword);

    const passwordHash = await hashPassword(rawPassword);
    const staff = await userService.createStaffAccount({
      name: validated.name,
      email: validated.email,
      passwordHash,
    });

    const inviteUrl = `${env.APP_URL}/login`;
    const template = accountInvitationTemplate(inviteUrl, staff.name, "Staff", rawPassword);

    await emailService.sendEmail({
      to: staff.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      userId: staff.id,
    });

    await writeAuditLog({
      userId: adminUser.id,
      action: "STAFF_ACCOUNT_CREATED",
      entityType: "User",
      entityId: staff.id,
      metadata: { createdByAdmin: adminUser.email, staffEmail: staff.email },
    });

    revalidatePath("/admin/staff");

    return {
      success: true,
      message: `Staff account created for ${staff.email}.`,
      data: { id: staff.id, name: staff.name, email: staff.email, role: staff.role },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create staff account";
    return { success: false, error: message };
  }
}

