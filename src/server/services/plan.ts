import { db } from "@/server/db";
import { PlanInput } from "@/schemas/catalog";
import { toDecimal } from "@/lib/money";
import { AppError } from "@/lib/errors";

export class PlanService {
  /**
   * Retrieves paginated plans with optional search and active status filter
   */
  static async listPlans(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    isActive?: boolean;
    interval?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  }) {
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.max(1, Math.min(100, params?.pageSize || 10));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }
    if (params?.interval) {
      where.billingInterval = params.interval;
    }
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { code: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [total, plans] = await Promise.all([
      db.plan.count({ where }),
      db.plan.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          planProducts: {
            include: {
              product: true,
            },
          },
          _count: {
            select: { subscriptions: true },
          },
        },
      }),
    ]);

    return {
      data: plans,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Finds a plan by ID with mapped products
   */
  static async getPlanById(id: string) {
    const plan = await db.plan.findUnique({
      where: { id },
      include: {
        planProducts: {
          include: {
            product: true,
          },
        },
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!plan) {
      throw AppError.notFound(`Subscription plan with ID "${id}" not found`);
    }

    return plan;
  }

  /**
   * Creates a new plan along with optional plan_products
   */
  static async createPlan(input: PlanInput) {
    const existingCode = await db.plan.findUnique({
      where: { code: input.code.toUpperCase() },
    });

    if (existingCode) {
      throw AppError.conflict(`Plan code "${input.code}" is already in use`);
    }

    const price = toDecimal(input.price);

    return db.$transaction(async (tx) => {
      const plan = await tx.plan.create({
        data: {
          name: input.name,
          code: input.code.toUpperCase(),
          description: input.description,
          price: price.toString(),
          billingInterval: input.billingInterval,
          minQuantity: input.minQuantity ?? 1,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          autoCloseAtEnd: input.autoCloseAtEnd ?? false,
          allowEarlyClose: input.allowEarlyClose ?? true,
          allowPause: input.allowPause ?? true,
          allowRenewal: input.allowRenewal ?? true,
          isActive: input.isActive ?? true,
        },
      });

      if (input.products && input.products.length > 0) {
        await tx.planProduct.createMany({
          data: input.products.map((p) => ({
            planId: plan.id,
            productId: p.productId,
            quantity: p.quantity,
            isOptional: p.isOptional ?? false,
          })),
        });
      }

      return tx.plan.findUnique({
        where: { id: plan.id },
        include: {
          planProducts: {
            include: { product: true },
          },
        },
      });
    });
  }

  /**
   * Updates an existing plan and syncs plan_products if provided
   */
  static async updatePlan(id: string, input: Partial<PlanInput>) {
    await this.getPlanById(id);

    return db.$transaction(async (tx) => {
      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.code !== undefined) updateData.code = input.code.toUpperCase();
      if (input.description !== undefined) updateData.description = input.description;
      if (input.price !== undefined) updateData.price = toDecimal(input.price).toString();
      if (input.billingInterval !== undefined) updateData.billingInterval = input.billingInterval;
      if (input.minQuantity !== undefined) updateData.minQuantity = input.minQuantity;
      if (input.startDate !== undefined) {
        updateData.startDate = input.startDate ? new Date(input.startDate) : null;
      }
      if (input.endDate !== undefined) {
        updateData.endDate = input.endDate ? new Date(input.endDate) : null;
      }
      if (input.autoCloseAtEnd !== undefined) updateData.autoCloseAtEnd = input.autoCloseAtEnd;
      if (input.allowEarlyClose !== undefined) updateData.allowEarlyClose = input.allowEarlyClose;
      if (input.allowPause !== undefined) updateData.allowPause = input.allowPause;
      if (input.allowRenewal !== undefined) updateData.allowRenewal = input.allowRenewal;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      if (input.products !== undefined) {
        // Replace plan products
        await tx.planProduct.deleteMany({
          where: { planId: id },
        });

        if (input.products.length > 0) {
          await tx.planProduct.createMany({
            data: input.products.map((p) => ({
              planId: id,
              productId: p.productId,
              quantity: p.quantity,
              isOptional: p.isOptional ?? false,
            })),
          });
        }
      }

      return tx.plan.update({
        where: { id },
        data: updateData,
        include: {
          planProducts: {
            include: { product: true },
          },
        },
      });
    });
  }

  /**
   * Archives or activates a plan
   */
  static async togglePlanArchive(id: string, isActive?: boolean) {
    const existing = await this.getPlanById(id);
    const targetStatus = isActive !== undefined ? isActive : !existing.isActive;

    return db.plan.update({
      where: { id },
      data: { isActive: targetStatus },
    });
  }

  /**
   * Validates if a plan is available for subscription based on:
   * 1. Active status
   * 2. Start date & End date availability window
   * 3. Minimum quantity constraint
   */
  static async validatePlanAvailability(
    planId: string,
    quantity: number,
    targetDate: Date = new Date()
  ): Promise<{ valid: boolean; reason?: string }> {
    const plan = await db.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return { valid: false, reason: `Plan "${planId}" does not exist` };
    }

    if (!plan.isActive) {
      return { valid: false, reason: `Plan "${plan.name}" is currently inactive/archived` };
    }

    if (quantity < plan.minQuantity) {
      return {
        valid: false,
        reason: `Quantity ${quantity} is below the plan minimum required quantity (${plan.minQuantity})`,
      };
    }

    if (plan.startDate && targetDate < plan.startDate) {
      return {
        valid: false,
        reason: `Plan "${plan.name}" is not yet available (starts ${plan.startDate.toISOString().slice(0, 10)})`,
      };
    }

    if (plan.endDate && targetDate > plan.endDate) {
      return {
        valid: false,
        reason: `Plan "${plan.name}" expired on ${plan.endDate.toISOString().slice(0, 10)}`,
      };
    }

    return { valid: true };
  }
}

