import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { addInterval, isBefore } from "@/lib/dates";
import { writeAuditLog } from "@/lib/audit";
import { toDecimal, roundMoney } from "@/lib/money";
import { PricingService } from "./pricing";
import { EmailService } from "./email/email.service";
import { invoiceDeliveryTemplate } from "./email/templates";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import type { InvoiceStatus, Prisma } from "@prisma/client";
import Decimal from "decimal.js";

const emailService = new EmailService();

export class InvoiceService {
  /**
   * Generates a race-safe unique invoice number: INV-YYYY-XXXXXX
   */
  static async generateInvoiceNumber(tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx || db;
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const latest = await client.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });

    let nextSeq = 1;
    if (latest?.invoiceNumber) {
      const parts = latest.invoiceNumber.split("-");
      const currentSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(currentSeq)) {
        nextSeq = currentSeq + 1;
      }
    }

    return `${prefix}${nextSeq.toString().padStart(6, "0")}`;
  }

  /**
   * Calculates a due date based on payment terms string (e.g. "Net 30", "Net 15", "Immediate")
   */
  static calculateDueDate(issueDate: Date, paymentTerms: string): Date {
    const due = new Date(issueDate);
    const match = paymentTerms.match(/net\s*(\d+)/i);
    if (match) {
      const days = parseInt(match[1], 10);
      due.setDate(due.getDate() + days);
    } else if (paymentTerms.toLowerCase().includes("due on receipt") || paymentTerms.toLowerCase().includes("immediate")) {
      // Due today
    } else {
      // Default Net 30
      due.setDate(due.getDate() + 30);
    }
    return due;
  }

  /**
   * Generates an invoice for a subscription in ONE database transaction.
   * Validates eligibility (not paused/closed, within expiry).
   * Ensures idempotency: duplicate billing cycle attempts return existing invoice.
   * Records immutable snapshots and updates nextBillingDate exactly once.
   */
  static async generateInvoice(
    subscriptionId: string,
    periodStart: Date,
    periodEnd: Date,
    options?: {
      createdById?: string;
      autoSendEmail?: boolean;
    }
  ) {
    const startIso = periodStart.toISOString().split("T")[0];
    const endIso = periodEnd.toISOString().split("T")[0];
    const cycleKey = `sub_${subscriptionId}_${startIso}_${endIso}`;

    // Perform generation within a single database transaction
    const invoice = await db.$transaction(async (tx) => {
      // 1. Idempotency Check: Return existing invoice if cycle already billed
      const existingCycle = await tx.billingCycle.findUnique({
        where: { cycleKey },
        include: {
          invoice: {
            include: {
              items: {
                include: {
                  product: true,
                  variant: true,
                  taxRule: true,
                },
              },
              customer: {
                include: { user: true },
              },
              subscription: true,
            },
          },
        },
      });

      if (existingCycle && existingCycle.invoice) {
        logger.info("Invoice generation idempotency triggered: cycle already billed", {
          subscriptionId,
          cycleKey,
          invoiceId: existingCycle.invoice.id,
        });
        return existingCycle.invoice;
      }

      // 2. Fetch Subscription with items, products, variants, and tax rules
      const subscription = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          customer: {
            include: { user: true },
          },
          items: {
            include: {
              product: true,
              variant: true,
              taxRule: true,
            },
          },
        },
      });

      if (!subscription) {
        throw AppError.notFound(`Subscription with ID "${subscriptionId}" not found`);
      }

      // 3. Eligibility Validation
      if (subscription.status === "PAUSED") {
        throw AppError.badRequest("Cannot generate invoice for a paused subscription");
      }
      if (subscription.status === "CLOSED") {
        throw AppError.badRequest("Cannot generate invoice for a closed subscription");
      }
      if (subscription.status === "DRAFT") {
        throw new AppError("Cannot generate invoice for a draft subscription", "INVALID_STATE_TRANSITION", 400);
      }

      // Check expiry date
      if (subscription.expiryDate && isBefore(subscription.expiryDate, periodStart)) {
        throw AppError.badRequest(
          `Subscription expired on ${subscription.expiryDate.toISOString().split("T")[0]}`
        );
      }

      if (subscription.items.length === 0) {
        throw AppError.badRequest("Cannot generate invoice for subscription with no items");
      }

      // 4. Calculate Pricing with variant adjustments, discounts, and taxes
      const pricing = await PricingService.calculateInvoice(subscription, {
        periodStart,
        periodEnd,
      });

      // 5. Generate Race-Safe Invoice Number
      const invoiceNumber = await this.generateInvoiceNumber(tx);
      const issueDate = new Date();
      const dueDate = this.calculateDueDate(issueDate, subscription.paymentTerms);

      // 6. Create Invoice (Status DRAFT)
      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          status: "DRAFT",
          issueDate,
          dueDate,
          subtotal: pricing.subtotal,
          taxTotal: pricing.taxTotal,
          discountTotal: pricing.discountTotal,
          totalAmount: pricing.totalAmount,
          amountPaid: new Decimal(0),
          amountDue: pricing.totalAmount,
          cycleKey,
          items: {
            create: pricing.lines.map((line) => ({
              productId: line.productId,
              productVariantId: line.productVariantId,
              taxRuleId: line.taxRuleId,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              taxAmount: line.taxAmount,
              discountAmount: line.discountAmount,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
              taxRule: true,
            },
          },
          customer: {
            include: { user: true },
          },
          subscription: true,
        },
      });

      // 7. Record Discount Redemptions & Update Usage
      for (const disc of pricing.discountsApplied) {
        await tx.discountRedemption.create({
          data: {
            discountRuleId: disc.ruleId,
            subscriptionId: subscription.id,
            invoiceId: createdInvoice.id,
            appliedAmount: disc.amount,
          },
        });

        await tx.discountRule.update({
          where: { id: disc.ruleId },
          data: {
            currentUsageCount: { increment: 1 },
          },
        });
      }

      // 8. Create Billing Cycle Record
      await tx.billingCycle.create({
        data: {
          subscriptionId: subscription.id,
          invoiceId: createdInvoice.id,
          cycleKey,
          periodStart,
          periodEnd,
          status: "BILLED",
        },
      });

      // 9. Update Subscription nextBillingDate Exactly Once
      const nextDate = addInterval(subscription.nextBillingDate || periodEnd, subscription.billingInterval, 1);
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingDate: nextDate,
        },
      });

      // 10. Write Audit Log
      await writeAuditLog({
        action: "INVOICE_GENERATED",
        entityType: "Invoice",
        entityId: createdInvoice.id,
        metadata: {
          invoiceNumber,
          subscriptionId: subscription.id,
          totalAmount: pricing.totalAmount.toString(),
          cycleKey,
        },
        userId: options?.createdById || null,
      });

      return createdInvoice;
    });

    // Post-commit non-blocking email notification
    if (options?.autoSendEmail) {
      await this.sendInvoiceEmail(invoice.id).catch((err) => {
        logger.error("Post-commit invoice email delivery failure", {
          invoiceId: invoice.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    return invoice;
  }

  /**
   * Confirms a draft invoice and optionally dispatches email delivery
   */
  static async confirmInvoice(invoiceId: string, userId?: string) {
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: { include: { user: true } },
      },
    });

    if (!invoice) throw AppError.notFound(`Invoice "${invoiceId}" not found`);

    if (invoice.status === "CONFIRMED") {
      return invoice;
    }

    if (invoice.status === "PAID") {
      throw new AppError("Cannot confirm an already paid invoice", "INVALID_STATE_TRANSITION", 400);
    }

    if (invoice.status === "CANCELLED") {
      throw new AppError("Cannot confirm a cancelled invoice", "INVALID_STATE_TRANSITION", 400);
    }

    const updated = await db.$transaction(async (tx) => {
      const res = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: "CONFIRMED" },
        include: {
          items: true,
          customer: { include: { user: true } },
          subscription: true,
        },
      });

      await writeAuditLog({
        action: "INVOICE_CONFIRMED",
        entityType: "Invoice",
        entityId: invoiceId,
        metadata: { previousStatus: invoice.status, newStatus: "CONFIRMED" },
        userId: userId || null,
      });

      return res;
    });

    // Dispatch email notification after successful commit
    await this.sendInvoiceEmail(updated.id).catch((err) => {
      logger.error("Post-confirm invoice email delivery failure", {
        invoiceId: updated.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return updated;
  }

  /**
   * Cancels an invoice.
   * STRICT RULE: Paid invoices CANNOT be cancelled! No deletions allowed.
   */
  static async cancelInvoice(invoiceId: string, reason?: string, userId?: string) {
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) throw AppError.notFound(`Invoice "${invoiceId}" not found`);

    if (invoice.status === "PAID") {
      throw new AppError(
        "Paid invoices cannot be cancelled. Record a refund or adjustment instead.",
        "INVALID_STATE_TRANSITION",
        400
      );
    }

    if (invoice.status === "CANCELLED") {
      return invoice;
    }

    return db.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "CANCELLED",
          notes: reason ? `${invoice.notes ? invoice.notes + "\n" : ""}Cancelled: ${reason}` : invoice.notes,
        },
        include: {
          items: true,
          customer: { include: { user: true } },
          subscription: true,
        },
      });

      await writeAuditLog({
        action: "INVOICE_CANCELLED",
        entityType: "Invoice",
        entityId: invoiceId,
        metadata: { reason: reason || "User requested cancellation" },
        userId: userId || null,
      });

      return updated;
    });
  }

  /**
   * Records full or partial payment on an invoice.
   * When paid in full, status transitions to PAID.
   */
  static async markPaid(
    invoiceId: string,
    amount?: number,
    paymentMethod: string = "BANK_TRANSFER",
    userId?: string
  ) {
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) throw AppError.notFound(`Invoice "${invoiceId}" not found`);

    if (invoice.status === "CANCELLED") {
      throw new AppError("Cannot apply payment to a cancelled invoice", "INVALID_STATE_TRANSITION", 400);
    }

    const payAmount = amount ? toDecimal(amount) : invoice.amountDue;
    const newAmountPaid = roundMoney(invoice.amountPaid.plus(payAmount));
    const newAmountDue = roundMoney(Decimal.max(new Decimal(0), invoice.totalAmount.minus(newAmountPaid)));
    const isFullyPaid = newAmountDue.isZero() || newAmountDue.isNegative();

    return db.$transaction(async (tx) => {
      // Record payment row
      const year = new Date().getFullYear();
      const count = await tx.payment.count();
      const paymentNumber = `PAY-${year}-${(count + 1).toString().padStart(6, "0")}`;

      await tx.payment.create({
        data: {
          invoiceId,
          customerId: invoice.customerId,
          paymentNumber,
          paymentMethod: paymentMethod as any,
          amount: payAmount,
          referenceNote: "Payment recorded",
        },
      });

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: isFullyPaid ? "PAID" : invoice.status,
          paidDate: isFullyPaid ? new Date() : invoice.paidDate,
        },
        include: {
          items: true,
          customer: { include: { user: true } },
          payments: true,
        },
      });

      await writeAuditLog({
        action: "PAYMENT_RECORDED",
        entityType: "Invoice",
        entityId: invoiceId,
        metadata: {
          paymentNumber,
          amount: payAmount.toString(),
          status: isFullyPaid ? "PAID" : invoice.status,
        },
        userId: userId || null,
      });

      return updated;
    });
  }

  /**
   * Dispatches the invoice delivery email to the customer.
   * Completely safe and non-blocking.
   */
  static async sendInvoiceEmail(invoiceId: string, customRecipient?: string) {
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: { include: { user: true } },
      },
    });

    if (!invoice) throw AppError.notFound(`Invoice "${invoiceId}" not found`);

    const recipient = customRecipient || invoice.customer?.user?.email || invoice.customer?.email;
    if (!recipient) {
      logger.warn("Skipping invoice email delivery: No recipient email found", { invoiceId });
      return { success: false, error: "No recipient email found" };
    }

    const customerName = invoice.customer.name || invoice.customer.user?.name || "Valued Customer";
    const dueDateStr = invoice.dueDate.toISOString().split("T")[0];
    const viewUrl = `${env.APP_URL || "http://localhost:3000"}/customer/invoices/${invoice.id}`;

    const template = invoiceDeliveryTemplate(
      customerName,
      invoice.invoiceNumber,
      `₹${invoice.totalAmount.toFixed(2)}`,
      dueDateStr,
      viewUrl
    );

    const emailResult = await emailService.sendEmail({
      to: recipient,
      subject: template.subject,
      html: template.html,
      text: template.text,
      invoiceId: invoice.id,
      userId: invoice.customer.userId,
    });

    if (emailResult.success) {
      await db.invoice.update({
        where: { id: invoiceId },
        data: { sentAt: new Date() },
      });
    }

    return emailResult;
  }

  /**
   * Fetches an invoice by ID with items, customer, and payments
   */
  static async getInvoiceById(id: string) {
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        subscription: {
          select: {
            id: true,
            subscriptionNumber: true,
            status: true,
            billingInterval: true,
            plan: { select: { id: true, name: true } },
          },
        },
        items: {
          include: {
            product: { select: { id: true, name: true } },
            variant: { select: { id: true, name: true, sku: true, priceModifier: true } },
            taxRule: { select: { id: true, name: true, rate: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
        },
        billingCycles: {
          orderBy: { createdAt: "desc" },
        },
        redemptions: {
          include: {
            discountRule: { select: { id: true, name: true, code: true, type: true } },
          },
        },
      },
    });

    if (!invoice) throw AppError.notFound(`Invoice with ID "${id}" not found`);
    return invoice;
  }

  /**
   * Lists invoices with filtering, search, and pagination
   */
  static async listInvoices(params: {
    status?: string;
    customerId?: string;
    paymentState?: string;
    startDate?: Date | string;
    endDate?: Date | string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.InvoiceWhereInput = {};

    if (params.status && params.status !== "ALL") {
      where.status = params.status as InvoiceStatus;
    }

    if (params.customerId) {
      where.customerId = params.customerId;
    }

    if (params.paymentState && params.paymentState !== "ALL") {
      const now = new Date();
      if (params.paymentState === "PAID") {
        where.status = "PAID";
      } else if (params.paymentState === "UNPAID") {
        where.status = { notIn: ["PAID", "CANCELLED"] };
      } else if (params.paymentState === "OVERDUE") {
        where.status = { notIn: ["PAID", "CANCELLED"] };
        where.dueDate = { lt: now };
      }
    }

    if (params.startDate || params.endDate) {
      where.issueDate = {};
      if (params.startDate) {
        where.issueDate.gte = typeof params.startDate === "string" ? new Date(params.startDate) : params.startDate;
      }
      if (params.endDate) {
        where.issueDate.lte = typeof params.endDate === "string" ? new Date(params.endDate) : params.endDate;
      }
    }

    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { user: { name: { contains: q, mode: "insensitive" } } } },
        { customer: { user: { email: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const [total, data] = await Promise.all([
      db.invoice.count({ where }),
      db.invoice.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { issueDate: "desc" },
        include: {
          customer: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          subscription: {
            select: { id: true, subscriptionNumber: true },
          },
          items: true,
          payments: true,
        },
      }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }
}
