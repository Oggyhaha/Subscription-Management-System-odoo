import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import type { Role, User, CustomerProfile } from "@prisma/client";

export class UserService {
  /**
   * Finds a user by unique lowercase email
   */
  async findByEmail(email: string): Promise<(User & { customerProfile: CustomerProfile | null }) | null> {
    return db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { customerProfile: true },
    });
  }

  /**
   * Finds a user by primary ID
   */
  async findById(id: string): Promise<(User & { customerProfile: CustomerProfile | null }) | null> {
    return db.user.findUnique({
      where: { id },
      include: { customerProfile: true },
    });
  }

  /**
   * Registers a new customer and atomically provisions their CustomerProfile
   */
  async registerCustomer(params: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<{ user: User; customerProfile: CustomerProfile }> {
    const email = params.email.toLowerCase().trim();

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      throw AppError.conflict("An account with this email address already exists");
    }

    return db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: params.name.trim(),
          email,
          passwordHash: params.passwordHash,
          role: "CUSTOMER",
        },
      });

      const customerProfile = await tx.customerProfile.create({
        data: {
          userId: user.id,
          name: params.name.trim(),
          email,
        },
      });

      return { user, customerProfile };
    });
  }

  /**
   * Creates an internal staff user (restricted to ADMIN callers)
   */
  async createStaffAccount(params: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<User> {
    const email = params.email.toLowerCase().trim();

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      throw AppError.conflict("An account with this email address already exists");
    }

    return db.user.create({
      data: {
        name: params.name.trim(),
        email,
        passwordHash: params.passwordHash,
        role: "STAFF",
      },
    });
  }

  /**
   * Stores hashed password reset token and expiration
   */
  async setResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: {
        resetToken: tokenHash,
        resetTokenExpiry: expiresAt,
      },
    });
  }

  /**
   * Finds user with valid, unexpired reset token hash
   */
  async findByValidResetToken(tokenHash: string): Promise<User | null> {
    const user = await db.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });
    return user;
  }

  /**
   * Updates user password and revokes single-use reset token
   */
  async updatePasswordAndClearResetToken(userId: string, passwordHash: string): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  }
}

export const userService = new UserService();

