import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { addInterval, isBefore, isAfter } from "@/lib/dates";
import { writeAuditLog } from "@/lib/audit";
import { toDecimal, roundMoney, addMoney, subtractMoney, multiplyMoney } from "@/lib/money";
import { TaxService } from "@/server/services/tax";
import type { CreateSubscriptionInput, SubscriptionActionInput } from "@/schemas/subscription";
import type { SubscriptionStatus, BillingInterval, Prisma } from "@prisma/client";
import Decimal from "decimal.js";

export class SubscriptionService {
  /**
   * Generates a race-safe unique subscription number: SUB-YYYY-XXXXXX
   */
  static async generateSubscriptionNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SUB-${year}-`;

    const latest = await db.subscription.findFirst({
      where: { subscriptionNumber: { startsWith: prefix } },
      orderBy: { subscriptionNumber: "desc" },
      select: { subscriptionNumber: true },
    });

    let nextSeq = 1;
    if (latest?.subscriptionNumber) {
      const parts = latest.subscriptionNumber.split("-");
      const currentSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(currentSeq)) {
        nextSeq = currentSeq + 1;
      }
    }

    return `${prefix}${nextSeq.toString().padStart(6, "0")}`;
  }

  /**
   * Creates a direct subscription (manual or backoffice provisioning)
   */
  async createSubscription(input: CreateSubscriptionInput, userId?: string) {
    const customer = await db.customerProfile.findUnique({
      where: { id: input.customerId },
    });
    if (!customer) throw AppError.notFound(`Customer with ID ${input.customerId}`);

    const plan = await db.plan.findUnique({
      where: { id: input.planId },
    });
    if (!plan) throw AppError.notFound(`Plan with ID ${input.planId}`);

    const startDate = typeof input.startDate === "string" ? new Date(input.startDate) : input.startDate;
    const currentPeriodStart = startDate;
    const currentPeriodEnd = addInterval(startDate, input.billingInterval, 1);
    const nextBillingDate = currentPeriodEnd;

    const subscriptionNumber = await SubscriptionService.generateSubscriptionNumber();

    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);
    let discountTotal = new Decimal(0);

    const calculatedItems = await Promise.all(
      input.items.map(async (item) => {
        const product = await db.product.findUnique({ where: { id: item.productId } });
        if (!product) throw AppError.notFound(`Product with ID ${item.productId}`);

        let unitPrice = toDecimal(item.unitPrice);
        if (item.productVariantId) {
          const variant = await db.productVariant.findUnique({ where: { id: item.productVariantId } });
          if (variant && variant.priceModifier.greaterThan(0)) {
            unitPrice = addMoney(unitPrice, variant.priceModifier);
          }
        }

        const qty = new Decimal(item.quantity);
        const lineBase = multiplyMoney(unitPrice, qty);
        const lineDiscount = roundMoney(item.discountAmount || 0);
        const lineAfterDiscount = subtractMoney(lineBase, lineDiscount);

        let lineTax = new Decimal(0);
        if (item.taxRuleId) {
          const taxRule = await db.taxRule.findUnique({ where: { id: item.taxRuleId } });
          if (taxRule) {
            const taxCalc = TaxService.calculateTax(lineAfterDiscount, { rate: taxRule.rate });
            lineTax = taxCalc.taxAmount;
          }
        }

        const lineTotal = addMoney(lineAfterDiscount, lineTax);
        subtotal = addMoney(subtotal, lineBase);
        discountTotal = addMoney(discountTotal, lineDiscount);
        taxTotal = addMoney(taxTotal, lineTax);

        return {
          productId: item.productId,
          productVariantId: item.productVariantId || null,
          taxRuleId: item.taxRuleId || null,
          description: item.description || product.name,
          quantity: item.quantity,
          unitPrice,
          taxAmount: lineTax,
          discountAmount: lineDiscount,
          lineTotal,
        };
      })
    );

    const totalAmount = addMoney(subtractMoney(subtotal, discountTotal), taxTotal);
    const expiryDate = input.expiryDate ? (typeof input.expiryDate === "string" ? new Date(input.expiryDate) : input.expiryDate) : null;

    return db.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          subscriptionNumber,
          customerId: input.customerId,
          planId: input.planId,
          quotationId: input.quotationId || null,
          status: "DRAFT",
          startDate,
          expiryDate,
          currentPeriodStart,
          currentPeriodEnd,
          nextBillingDate,
          paymentTerms: input.paymentTerms || "Net 30",
          billingInterval: input.billingInterval,
          autoCloseAtEnd: input.autoCloseAtEnd ?? plan.autoCloseAtEnd,
          allowEarlyClose: input.allowEarlyClose ?? plan.allowEarlyClose,
          allowPause: input.allowPause ?? plan.allowPause,
          allowRenewal: input.allowRenewal ?? plan.allowRenewal,
          subtotal,
          taxTotal,
          discountTotal,
          totalAmount,
          notes: input.notes || null,
          items: {
            create: calculatedItems,
          },
        },
        include: {
          customer: true,
          plan: true,
          items: true,
        },
      });

      await writeAuditLog({
        userId,
        action: "SUBSCRIPTION_CREATED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          subscriptionNumber: subscription.subscriptionNumber,
          customer: customer.name,
          plan: plan.name,
        },
      });

      return subscription;
    });
  }

  // -------------------------------------------------------------
  // STATE MACHINE & LIFECYCLE TRANSITIONS
  // -------------------------------------------------------------

  /**
   * Core state machine transition validator and executor.
   * Throws typed AppError on invalid transition.
   */
  async transitionState(input: SubscriptionActionInput, userId?: string) {
    const subscription = await this.getSubscriptionById(input.subscriptionId);
    const currentState = subscription.status;
    const action = input.action;

    let targetState: SubscriptionStatus;
    const updates: Prisma.SubscriptionUpdateInput = {};

    switch (action) {
      case "CONFIRM": {
        if (currentState !== "DRAFT" && currentState !== "QUOTATION") {
          throw AppError.invalidTransition(currentState, "CONFIRMED");
        }
        targetState = "CONFIRMED";
        break;
      }

      case "ACTIVATE": {
        if (currentState !== "CONFIRMED" && currentState !== "PAUSED") {
          throw AppError.invalidTransition(currentState, "ACTIVE");
        }
        targetState = "ACTIVE";
        break;
      }

      case "PAUSE": {
        if (currentState !== "ACTIVE") {
          throw AppError.invalidTransition(currentState, "PAUSED");
        }
        if (!subscription.allowPause) {
          throw AppError.badRequest("This subscription plan does not allow pausing.");
        }
        targetState = "PAUSED";
        break;
      }

      case "RESUME": {
        if (currentState !== "PAUSED") {
          throw AppError.invalidTransition(currentState, "ACTIVE");
        }
        targetState = "ACTIVE";
        break;
      }

      case "RENEW": {
        if (currentState !== "ACTIVE") {
          throw AppError.invalidTransition(currentState, "ACTIVE (Renewal)");
        }
        if (!subscription.allowRenewal) {
          throw AppError.badRequest("This subscription plan does not allow renewal.");
        }

        // Extend currentPeriodEnd by interval safely
        const newPeriodEnd = addInterval(
          subscription.currentPeriodEnd,
          subscription.billingInterval,
          1
        );
        updates.currentPeriodEnd = newPeriodEnd;
        updates.nextBillingDate = newPeriodEnd;
        targetState = "ACTIVE";
        break;
      }

      case "CLOSE": {
        if (currentState === "CLOSED") {
          throw AppError.badRequest("Subscription is already closed.");
        }

        // If early close, check if plan allows early close
        const now = new Date();
        const isEarly = isBefore(now, subscription.currentPeriodEnd);
        if (isEarly && !subscription.allowEarlyClose) {
          throw AppError.badRequest("Early closure is not permitted under this plan's terms.");
        }

        targetState = "CLOSED";
        updates.expiryDate = now;
        updates.nextBillingDate = null;
        break;
      }

      default:
        throw AppError.badRequest(`Unknown subscription action: ${action}`);
    }

    const updated = await db.subscription.update({
      where: { id: input.subscriptionId },
      data: {
        status: targetState,
        ...updates,
        notes: input.reason
          ? `${subscription.notes || ""}\n[${action}]: ${input.reason}`.trim()
          : subscription.notes,
      },
      include: {
        customer: true,
        plan: true,
        items: true,
      },
    });

    await writeAuditLog({
      userId,
      action: `SUBSCRIPTION_${action}`,
      entityType: "Subscription",
      entityId: subscription.id,
      oldState: { status: currentState },
      newState: { status: targetState },
      metadata: { action, reason: input.reason || null },
    });

    return updated;
  }

  /**
   * Process automatic closures for subscriptions whose period has ended and autoCloseAtEnd is enabled
   */
  async processAutoClosures(): Promise<number> {
    const now = new Date();
    const toClose = await db.subscription.findMany({
      where: {
        status: "ACTIVE",
        autoCloseAtEnd: true,
        currentPeriodEnd: { lte: now },
      },
    });

    for (const sub of toClose) {
      await db.subscription.update({
        where: { id: sub.id },
        data: {
          status: "CLOSED",
          nextBillingDate: null,
          notes: `${sub.notes || ""}\n[Auto-Closed at period end]`.trim(),
        },
      });

      await writeAuditLog({
        action: "SUBSCRIPTION_AUTO_CLOSED",
        entityType: "Subscription",
        entityId: sub.id,
        metadata: { periodEnd: sub.currentPeriodEnd.toISOString() },
      });
    }

    return toClose.length;
  }

  // -------------------------------------------------------------
  // QUERY & RETRIEVAL
  // -------------------------------------------------------------

  async listSubscriptions(params?: {
    status?: SubscriptionStatus;
    customerId?: string;
    planId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SubscriptionWhereInput = {
      status: params?.status,
      customerId: params?.customerId,
      planId: params?.planId,
      ...(params?.search
        ? {
            OR: [
              { subscriptionNumber: { contains: params.search, mode: "insensitive" } },
              { customer: { name: { contains: params.search, mode: "insensitive" } } },
              { plan: { name: { contains: params.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.subscription.findMany({
        where,
        include: {
          customer: true,
          plan: true,
          _count: { select: { invoices: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.subscription.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getSubscriptionById(id: string) {
    const subscription = await db.subscription.findUnique({
      where: { id },
      include: {
        customer: true,
        plan: true,
        quotation: true,
        items: {
          include: {
            product: true,
            variant: true,
            taxRule: true,
          },
        },
        invoices: {
          orderBy: { issueDate: "desc" },
          take: 10,
        },
        billingCycles: {
          orderBy: { periodStart: "desc" },
          take: 10,
        },
      },
    });

    if (!subscription) {
      throw AppError.notFound(`Subscription with ID ${id}`);
    }

    return subscription;
  }
}

export const subscriptionService = new SubscriptionService();

