import Decimal from "decimal.js";
import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { toDecimal, roundMoney } from "@/lib/money";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "@/server/auth/password";
import { SubscriptionService } from "@/server/services/subscription";
import type { CustomerProfileUpdateInput } from "@/schemas/portal";
import type { InvoiceStatus, SubscriptionStatus } from "@prisma/client";

const subscriptionService = new SubscriptionService();

/**
 * Resolves the authenticated customer's profile ID from the user account.
 * Throws notFound if the customer profile does not exist.
 */
export async function resolveCustomerId(
  userId: string,
  cachedCustomerProfileId?: string | null
): Promise<string> {
  if (cachedCustomerProfileId) {
    return cachedCustomerProfileId;
  }

  const profile = await db.customerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    throw AppError.notFound("Customer account profile not found");
  }

  return profile.id;
}

export class CustomerPortalService {
  /**
   * Retrieves dashboard overview for the authenticated customer:
   * Active subscriptions, next renewal date & amount, and total outstanding balance.
   */
  async getDashboardSummary(customerId: string) {
    const [activeSubscriptions, upcomingRenewals, confirmedInvoices, recentPayments] =
      await Promise.all([
        db.subscription.findMany({
          where: { customerId, status: "ACTIVE" },
          include: {
            plan: { select: { id: true, name: true, billingInterval: true, code: true } },
          },
          orderBy: { nextBillingDate: "asc" },
        }),
        db.subscription.findFirst({
          where: {
            customerId,
            status: "ACTIVE",
            nextBillingDate: { not: null },
          },
          orderBy: { nextBillingDate: "asc" },
          select: {
            nextBillingDate: true,
            totalAmount: true,
            plan: { select: { name: true } },
          },
        }),
        db.invoice.findMany({
          where: {
            customerId,
            status: "CONFIRMED",
            amountDue: { gt: 0 },
          },
          select: {
            id: true,
            invoiceNumber: true,
            amountDue: true,
            totalAmount: true,
            dueDate: true,
          },
          orderBy: { dueDate: "asc" },
        }),
        db.payment.findMany({
          where: { customerId },
          include: {
            invoice: { select: { id: true, invoiceNumber: true } },
          },
          orderBy: { paymentDate: "desc" },
          take: 5,
        }),
      ]);

    const totalOutstanding = confirmedInvoices.reduce<Decimal>(
      (sum, inv) => sum.plus(toDecimal(inv.amountDue)),
      new Decimal(0)
    );

    return {
      activeSubscriptionsCount: activeSubscriptions.length,
      activeSubscriptions: activeSubscriptions.map((s) => ({
        ...s,
        subtotal: toDecimal(s.subtotal).toNumber(),
        totalAmount: toDecimal(s.totalAmount).toNumber(),
      })),
      nextRenewal: upcomingRenewals
        ? {
            date: upcomingRenewals.nextBillingDate,
            amount: toDecimal(upcomingRenewals.totalAmount).toNumber(),
            planName: upcomingRenewals.plan.name,
          }
        : null,
      totalOutstanding: roundMoney(totalOutstanding).toNumber(),
      unpaidInvoicesCount: confirmedInvoices.length,
      recentInvoices: confirmedInvoices.slice(0, 5).map((inv) => ({
        ...inv,
        amountDue: toDecimal(inv.amountDue).toNumber(),
        totalAmount: toDecimal(inv.totalAmount).toNumber(),
      })),
      recentPayments: recentPayments.map((p) => ({
        ...p,
        amount: toDecimal(p.amount).toNumber(),
      })),
    };
  }

  /**
   * Lists all subscriptions strictly filtered by the authenticated customer's ID.
   */
  async listSubscriptions(customerId: string) {
    const subscriptions = await db.subscription.findMany({
      where: { customerId },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            code: true,
            billingInterval: true,
            allowPause: true,
            allowRenewal: true,
            allowEarlyClose: true,
          },
        },
        items: {
          include: {
            product: { select: { id: true, name: true, type: true } },
            variant: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: { invoices: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return subscriptions.map((s) => ({
      ...s,
      subtotal: toDecimal(s.subtotal).toNumber(),
      taxTotal: toDecimal(s.taxTotal).toNumber(),
      discountTotal: toDecimal(s.discountTotal).toNumber(),
      totalAmount: toDecimal(s.totalAmount).toNumber(),
      canPause: s.status === "ACTIVE" && s.allowPause,
      canResume: s.status === "PAUSED" && s.allowPause,
      canRenew: s.status === "ACTIVE" && s.allowRenewal,
    }));
  }

  /**
   * Retrieves full subscription details strictly for the authenticated customer.
   * Returns NOT FOUND if the subscription belongs to another customer or does not exist.
   */
  async getSubscriptionDetails(customerId: string, subscriptionId: string) {
    const subscription = await db.subscription.findFirst({
      where: {
        id: subscriptionId,
        customerId, // Strict tenant separation
      },
      include: {
        plan: true,
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
          select: {
            id: true,
            invoiceNumber: true,
            issueDate: true,
            dueDate: true,
            totalAmount: true,
            amountPaid: true,
            amountDue: true,
            status: true,
          },
        },
      },
    });

    if (!subscription) {
      // Must return not-found, NOT forbidden, to prevent ID enumeration
      throw AppError.notFound("Subscription not found");
    }

    return {
      ...subscription,
      subtotal: toDecimal(subscription.subtotal).toNumber(),
      taxTotal: toDecimal(subscription.taxTotal).toNumber(),
      discountTotal: toDecimal(subscription.discountTotal).toNumber(),
      totalAmount: toDecimal(subscription.totalAmount).toNumber(),
      items: subscription.items.map((it) => ({
        ...it,
        unitPrice: toDecimal(it.unitPrice).toNumber(),
        discountAmount: toDecimal(it.discountAmount).toNumber(),
        taxAmount: toDecimal(it.taxAmount).toNumber(),
        lineTotal: toDecimal(it.lineTotal).toNumber(),
      })),
      invoices: subscription.invoices.map((inv) => ({
        ...inv,
        totalAmount: toDecimal(inv.totalAmount).toNumber(),
        amountPaid: toDecimal(inv.amountPaid).toNumber(),
        amountDue: toDecimal(inv.amountDue).toNumber(),
      })),
      canPause: subscription.status === "ACTIVE" && subscription.allowPause,
      canResume: subscription.status === "PAUSED" && subscription.allowPause,
      canRenew: subscription.status === "ACTIVE" && subscription.allowRenewal,
    };
  }

  /**
   * Customer-initiated action: Pause active subscription
   */
  async pauseSubscription(customerId: string, subscriptionId: string, userId: string) {
    const sub = await db.subscription.findFirst({
      where: { id: subscriptionId, customerId },
    });

    if (!sub) {
      throw AppError.notFound("Subscription not found");
    }

    if (sub.status !== "ACTIVE") {
      throw AppError.badRequest("Only active subscriptions can be paused");
    }

    if (!sub.allowPause) {
      throw AppError.badRequest("Your current subscription plan terms do not permit pausing");
    }

    return subscriptionService.transitionState(
      {
        subscriptionId,
        action: "PAUSE",
      },
      userId
    );
  }

  /**
   * Customer-initiated action: Resume paused subscription
   */
  async resumeSubscription(customerId: string, subscriptionId: string, userId: string) {
    const sub = await db.subscription.findFirst({
      where: { id: subscriptionId, customerId },
    });

    if (!sub) {
      throw AppError.notFound("Subscription not found");
    }

    if (sub.status !== "PAUSED") {
      throw AppError.badRequest("Only paused subscriptions can be resumed");
    }

    return subscriptionService.transitionState(
      {
        subscriptionId,
        action: "RESUME",
      },
      userId
    );
  }

  /**
   * Customer-initiated action: Renew subscription period
   */
  async renewSubscription(customerId: string, subscriptionId: string, userId: string) {
    const sub = await db.subscription.findFirst({
      where: { id: subscriptionId, customerId },
    });

    if (!sub) {
      throw AppError.notFound("Subscription not found");
    }

    if (sub.status !== "ACTIVE") {
      throw AppError.badRequest("Only active subscriptions can be renewed");
    }

    if (!sub.allowRenewal) {
      throw AppError.badRequest("Your current subscription plan terms do not permit renewal");
    }

    return subscriptionService.transitionState(
      {
        subscriptionId,
        action: "RENEW",
      },
      userId
    );
  }

  /**
   * Lists customer invoices with status filtering and pagination.
   */
  async listInvoices(
    customerId: string,
    params?: { status?: string; skip?: number; take?: number }
  ) {
    const where: { customerId: string; status?: InvoiceStatus } = { customerId };

    if (params?.status && params.status !== "ALL") {
      where.status = params.status as InvoiceStatus;
    }

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        include: {
          subscription: {
            select: { id: true, subscriptionNumber: true, plan: { select: { name: true } } },
          },
          payments: {
            select: { id: true, amount: true, paymentDate: true },
          },
        },
        orderBy: { issueDate: "desc" },
        skip: params?.skip ?? 0,
        take: params?.take ?? 25,
      }),
      db.invoice.count({ where }),
    ]);

    return {
      invoices: invoices.map((inv) => ({
        ...inv,
        subtotal: toDecimal(inv.subtotal).toNumber(),
        taxTotal: toDecimal(inv.taxTotal).toNumber(),
        discountTotal: toDecimal(inv.discountTotal).toNumber(),
        totalAmount: toDecimal(inv.totalAmount).toNumber(),
        amountPaid: toDecimal(inv.amountPaid).toNumber(),
        amountDue: toDecimal(inv.amountDue).toNumber(),
      })),
      total,
    };
  }

  /**
   * Retrieves invoice details strictly for the authenticated customer.
   * Returns NOT FOUND for invoices belonging to any other customer.
   */
  async getInvoiceDetails(customerId: string, invoiceId: string) {
    const invoice = await db.invoice.findFirst({
      where: {
        id: invoiceId,
        customerId, // Strict customer scoping
      },
      include: {
        customer: true,
        subscription: {
          include: { plan: true },
        },
        items: {
          include: {
            product: true,
            variant: true,
            taxRule: true,
          },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
        },
      },
    });

    if (!invoice) {
      throw AppError.notFound("Invoice not found");
    }

    return {
      ...invoice,
      subtotal: toDecimal(invoice.subtotal).toNumber(),
      taxTotal: toDecimal(invoice.taxTotal).toNumber(),
      discountTotal: toDecimal(invoice.discountTotal).toNumber(),
      totalAmount: toDecimal(invoice.totalAmount).toNumber(),
      amountPaid: toDecimal(invoice.amountPaid).toNumber(),
      amountDue: toDecimal(invoice.amountDue).toNumber(),
      items: invoice.items.map((it) => ({
        ...it,
        unitPrice: toDecimal(it.unitPrice).toNumber(),
        discountAmount: toDecimal(it.discountAmount).toNumber(),
        taxAmount: toDecimal(it.taxAmount).toNumber(),
        lineTotal: toDecimal(it.lineTotal).toNumber(),
      })),
      payments: invoice.payments.map((p) => ({
        ...p,
        amount: toDecimal(p.amount).toNumber(),
      })),
    };
  }

  /**
   * Lists all payments made by the authenticated customer.
   */
  async listPayments(customerId: string, params?: { skip?: number; take?: number }) {
    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where: { customerId },
        include: {
          invoice: {
            select: { id: true, invoiceNumber: true, totalAmount: true, status: true },
          },
        },
        orderBy: { paymentDate: "desc" },
        skip: params?.skip ?? 0,
        take: params?.take ?? 25,
      }),
      db.payment.count({ where: { customerId } }),
    ]);

    return {
      payments: payments.map((p) => ({
        ...p,
        amount: toDecimal(p.amount).toNumber(),
        invoice: p.invoice
          ? {
              ...p.invoice,
              totalAmount: toDecimal(p.invoice.totalAmount).toNumber(),
            }
          : null,
      })),
      total,
    };
  }

  /**
   * Retrieves profile and linked user info for the authenticated customer.
   */
  async getProfile(customerId: string) {
    const profile = await db.customerProfile.findUnique({
      where: { id: customerId },
      include: {
        user: { select: { id: true, email: true, name: true, createdAt: true } },
      },
    });

    if (!profile) {
      throw AppError.notFound("Customer profile not found");
    }

    return profile;
  }

  /**
   * Updates billing address and contact profile for the authenticated customer.
   */
  async updateProfile(customerId: string, input: CustomerProfileUpdateInput) {
    const profile = await db.customerProfile.findUnique({
      where: { id: customerId },
    });

    if (!profile) {
      throw AppError.notFound("Customer profile not found");
    }

    const updated = await db.customerProfile.update({
      where: { id: customerId },
      data: {
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        addressLine1: input.addressLine1?.trim() || null,
        addressLine2: input.addressLine2?.trim() || null,
        city: input.city?.trim() || null,
        state: input.state?.trim() || null,
        postalCode: input.postalCode?.trim() || null,
        country: input.country?.trim() || "US",
        taxIdentifier: input.taxIdentifier?.trim() || null,
      },
    });

    // Synchronize name on User record if linked
    if (profile.userId) {
      await db.user.update({
        where: { id: profile.userId },
        data: { name: input.name.trim() },
      });
    }

    await writeAuditLog({
      userId: profile.userId,
      action: "CUSTOMER_PROFILE_UPDATED",
      entityType: "CustomerProfile",
      entityId: profile.id,
      newState: { name: updated.name, country: updated.country },
    });

    return updated;
  }

  /**
   * Allows customer to change their password securely.
   */
  async changePassword(userId: string, currentPass: string, newPass: string) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound("User account not found");
    }

    const isValid = await verifyPassword(currentPass, user.passwordHash);
    if (!isValid) {
      throw AppError.badRequest("Current password entered is incorrect");
    }

    validatePasswordPolicy(newPass);
    const newHash = await hashPassword(newPass);

    await db.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CUSTOMER_PASSWORD_CHANGED",
      entityType: "User",
      entityId: user.id,
    });

    return true;
  }
}

export const customerPortalService = new CustomerPortalService();

