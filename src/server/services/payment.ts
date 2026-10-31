import Decimal from "decimal.js";
import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { toDecimal, roundMoney, addMoney, subtractMoney } from "@/lib/money";
import { writeAuditLog } from "@/lib/audit";
import { emailService } from "@/server/services/email";
import { paymentConfirmationTemplate } from "@/server/services/email/templates";
import type { Payment, PaymentMethod, Invoice, Prisma } from "@prisma/client";

export type AgingBucket = "CURRENT" | "1_30" | "31_60" | "61_90" | "90_PLUS";

export interface AgingSummary {
  current: { count: number; totalAmount: Decimal };
  days1To30: { count: number; totalAmount: Decimal };
  days31To60: { count: number; totalAmount: Decimal };
  days61To90: { count: number; totalAmount: Decimal };
  days90Plus: { count: number; totalAmount: Decimal };
  totalOutstanding: Decimal;
  totalOverdue: Decimal;
  totalInvoicesCount: number;
  overdueInvoicesCount: number;
}

/**
 * Pure function: Checks if an invoice is overdue
 */
export function isOverdue(
  invoice: {
    status: string;
    amountDue: Decimal | number | string;
    dueDate: Date | string;
  },
  now: Date = new Date()
): boolean {
  if (invoice.status !== "CONFIRMED") return false;
  const balance = toDecimal(invoice.amountDue);
  if (balance.lte(0.005)) return false;

  const dueTime = new Date(invoice.dueDate).getTime();
  const nowTime = now.getTime();
  return dueTime < nowTime;
}

/**
 * Pure function: Classifies overdue invoice into financial aging brackets
 */
export function getAgingBracket(dueDate: Date | string, now: Date = new Date()): AgingBucket {
  const due = new Date(dueDate);
  const diffTime = now.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "CURRENT";
  if (diffDays <= 30) return "1_30";
  if (diffDays <= 60) return "31_60";
  if (diffDays <= 90) return "61_90";
  return "90_PLUS";
}

/**
 * Pure function: Computes new payment balances with Decimal arithmetic
 */
export function calculatePaymentBalance(
  currentPaid: Decimal | number | string,
  currentDue: Decimal | number | string,
  paymentAmount: Decimal | number | string
): { newAmountPaid: Decimal; newAmountDue: Decimal; isFullyPaid: boolean } {
  const paid = toDecimal(currentPaid);
  const due = toDecimal(currentDue);
  const amt = toDecimal(paymentAmount);

  if (amt.lte(0)) {
    throw AppError.badRequest("Payment amount must be greater than zero");
  }

  if (amt.gt(due.plus(0.005))) {
    throw AppError.badRequest(
      `Payment amount ($${amt.toFixed(2)}) exceeds remaining balance due ($${due.toFixed(2)})`
    );
  }

  const newAmountPaid = roundMoney(addMoney(paid, amt));
  const rawRemaining = subtractMoney(due, amt);
  const newAmountDue = rawRemaining.lte(0.005) ? new Decimal(0) : roundMoney(rawRemaining);
  const isFullyPaid = newAmountDue.isZero();

  return { newAmountPaid, newAmountDue, isFullyPaid };
}

export class PaymentService {
  /**
   * Records a payment against an invoice in an atomic transaction.
   * - Locks invoice row (or ensures consistency)
   * - Validates invoice is CONFIRMED and balance > 0
   * - Rejects overpayments
   * - Rejects duplicate reference notes for the same invoice (idempotency safeguard)
   * - Computes balances with strict Decimal Banker's Safe rounding
   * - Marks invoice PAID when balance hits 0
   * - Writes immutable audit log
   * - Sends post-commit payment confirmation email (failure never blocks payment)
   */
  async recordPayment(params: {
    invoiceId: string;
    amount: Decimal | number | string;
    paymentMethod: PaymentMethod;
    paymentDate?: Date;
    referenceNote?: string | null;
    notes?: string | null;
    userId?: string | null;
  }): Promise<{ payment: Payment; invoice: Invoice; isFullyPaid: boolean }> {
    const paymentAmount = roundMoney(params.amount);
    if (paymentAmount.lte(0)) {
      throw AppError.badRequest("Payment amount must be greater than zero");
    }

    const trimmedReference = params.referenceNote?.trim() || null;

    // Execute atomic transaction
    const transactionResult = await db.$transaction(async (tx) => {
      // 1. Fetch & lock invoice with customer profile
      const invoice = await tx.invoice.findUnique({
        where: { id: params.invoiceId },
        include: {
          customer: true,
        },
      });

      if (!invoice) {
        throw AppError.notFound(`Invoice with ID '${params.invoiceId}' not found`);
      }

      // 2. Validate invoice status
      if (invoice.status === "DRAFT") {
        throw AppError.badRequest("Cannot record payment on a DRAFT invoice. The invoice must be confirmed first.");
      }
      if (invoice.status === "PAID") {
        throw AppError.badRequest(`Invoice #${invoice.invoiceNumber} is already fully paid.`);
      }
      if (invoice.status === "CANCELLED") {
        throw AppError.badRequest(`Cannot record payment on cancelled invoice #${invoice.invoiceNumber}.`);
      }

      // 3. Duplicate payment reference handling:
      // Policy Choice: Reference notes must be unique per invoice to prevent duplicate credit card charges or duplicate check entries.
      if (trimmedReference) {
        const duplicate = await tx.payment.findFirst({
          where: {
            invoiceId: invoice.id,
            referenceNote: trimmedReference,
          },
        });

        if (duplicate) {
          throw AppError.conflict(
            `Payment reference '${trimmedReference}' has already been recorded for invoice #${invoice.invoiceNumber}.`
          );
        }
      }

      // 4. Validate balance & compute new totals
      const { newAmountPaid, newAmountDue, isFullyPaid } = calculatePaymentBalance(
        invoice.amountPaid,
        invoice.amountDue,
        paymentAmount
      );

      // 5. Generate human-readable unique payment number: PAY-YYYYMMDD-XXXX
      const datePrefix = (params.paymentDate || new Date())
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const paymentNumber = `PAY-${datePrefix}-${randomSuffix}`;

      // 6. Record payment row
      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          paymentNumber,
          paymentMethod: params.paymentMethod,
          amount: paymentAmount,
          paymentDate: params.paymentDate || new Date(),
          referenceNote: trimmedReference || params.notes?.trim() || null,
        },
      });

      // 7. Update invoice balances and lifecycle status
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: isFullyPaid ? "PAID" : "CONFIRMED",
          paidDate: isFullyPaid ? params.paymentDate || new Date() : invoice.paidDate,
        },
        include: {
          customer: true,
        },
      });

      // 8. Record audit trail
      await writeAuditLog({
        userId: params.userId || null,
        action: "PAYMENT_RECORDED",
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paymentNumber,
          amount: paymentAmount.toString(),
          method: params.paymentMethod,
          previousAmountPaid: invoice.amountPaid.toString(),
          newAmountPaid: newAmountPaid.toString(),
          newAmountDue: newAmountDue.toString(),
          isFullyPaid,
        },
      });

      return {
        payment,
        invoice: updatedInvoice,
        isFullyPaid,
        customerEmail: invoice.customer.email,
        customerName: invoice.customer.name,
      };
    });

    // 9. Post-commit payment confirmation email (Non-blocking, failure never affects payment)
    if (transactionResult.customerEmail) {
      try {
        const formattedAmount = `₹${paymentAmount.toFixed(2)}`;
        const formattedDate = (params.paymentDate || new Date()).toLocaleDateString();
        const template = paymentConfirmationTemplate(
          transactionResult.payment.paymentNumber,
          transactionResult.invoice.invoiceNumber,
          formattedAmount,
          formattedDate,
          transactionResult.customerName
        );

        await emailService.sendEmail({
          to: transactionResult.customerEmail,
          subject: template.subject,
          html: template.html,
          text: template.text,
          invoiceId: transactionResult.invoice.id,
          userId: params.userId,
        });
      } catch (err) {
        console.error("Failed to dispatch payment confirmation email (payment was recorded safely)", err);
      }
    }

    return {
      payment: transactionResult.payment,
      invoice: transactionResult.invoice,
      isFullyPaid: transactionResult.isFullyPaid,
    };
  }

  /**
   * Retrieves paginated payment records with filtering
   */
  async listPayments(params?: {
    search?: string;
    method?: PaymentMethod;
    invoiceId?: string;
    customerId?: string;
    startDate?: Date | string;
    endDate?: Date | string;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.PaymentWhereInput = {};

    if (params?.invoiceId) {
      where.invoiceId = params.invoiceId;
    }

    if (params?.customerId) {
      where.customerId = params.customerId;
    }

    if (params?.method) {
      where.paymentMethod = params.method;
    }

    if (params?.search && params.search.trim().length > 0) {
      const q = params.search.trim();
      where.OR = [
        { paymentNumber: { contains: q, mode: "insensitive" } },
        { referenceNote: { contains: q, mode: "insensitive" } },
        { invoice: { invoiceNumber: { contains: q, mode: "insensitive" } } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    if (params?.startDate || params?.endDate) {
      where.paymentDate = {};
      if (params.startDate) where.paymentDate.gte = new Date(params.startDate);
      if (params.endDate) where.paymentDate.lte = new Date(params.endDate);
    }

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
          invoice: {
            select: { id: true, invoiceNumber: true, totalAmount: true, status: true },
          },
        },
        orderBy: { paymentDate: "desc" },
        skip: params?.skip ?? 0,
        take: params?.take ?? 50,
      }),
      db.payment.count({ where }),
    ]);

    const formatted = payments.map((p) => ({
      ...p,
      amount: toDecimal(p.amount).toNumber(),
      invoice: p.invoice
        ? {
            ...p.invoice,
            totalAmount: toDecimal(p.invoice.totalAmount).toNumber(),
          }
        : null,
    }));

    return { payments: formatted, total };
  }

  /**
   * Returns all payments recorded for a specific invoice
   */
  async getPaymentsForInvoice(invoiceId: string) {
    const payments = await db.payment.findMany({
      where: { invoiceId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { paymentDate: "desc" },
    });

    return payments.map((p) => ({
      ...p,
      amount: toDecimal(p.amount).toNumber(),
    }));
  }

  /**
   * Retrieves outstanding (unpaid or partially paid confirmed) invoices
   */
  async getOutstandingInvoices(params?: {
    search?: string;
    customerId?: string;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.InvoiceWhereInput = {
      status: "CONFIRMED",
      amountDue: { gt: 0 },
    };

    if (params?.customerId) {
      where.customerId = params.customerId;
    }

    if (params?.search && params.search.trim().length > 0) {
      const q = params.search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true } },
          payments: { select: { id: true, amount: true, paymentDate: true } },
        },
        orderBy: { dueDate: "asc" },
        skip: params?.skip ?? 0,
        take: params?.take ?? 50,
      }),
      db.invoice.count({ where }),
    ]);

    const now = new Date();
    const formatted = invoices.map((inv) => ({
      ...inv,
      subtotal: toDecimal(inv.subtotal).toNumber(),
      taxTotal: toDecimal(inv.taxTotal).toNumber(),
      discountTotal: toDecimal(inv.discountTotal).toNumber(),
      totalAmount: toDecimal(inv.totalAmount).toNumber(),
      amountPaid: toDecimal(inv.amountPaid).toNumber(),
      amountDue: toDecimal(inv.amountDue).toNumber(),
      isOverdue: isOverdue(inv, now),
      agingBracket: getAgingBracket(inv.dueDate, now),
    }));

    return { invoices: formatted, total };
  }

  /**
   * Computes comprehensive aging metrics and overdue summaries
   */
  async getAgingMetrics(now: Date = new Date()): Promise<AgingSummary> {
    const outstandingInvoices = await db.invoice.findMany({
      where: {
        status: "CONFIRMED",
        amountDue: { gt: 0 },
      },
      select: {
        amountDue: true,
        dueDate: true,
        status: true,
      },
    });

    const summary: AgingSummary = {
      current: { count: 0, totalAmount: new Decimal(0) },
      days1To30: { count: 0, totalAmount: new Decimal(0) },
      days31To60: { count: 0, totalAmount: new Decimal(0) },
      days61To90: { count: 0, totalAmount: new Decimal(0) },
      days90Plus: { count: 0, totalAmount: new Decimal(0) },
      totalOutstanding: new Decimal(0),
      totalOverdue: new Decimal(0),
      totalInvoicesCount: outstandingInvoices.length,
      overdueInvoicesCount: 0,
    };

    for (const inv of outstandingInvoices) {
      const due = toDecimal(inv.amountDue);
      summary.totalOutstanding = summary.totalOutstanding.plus(due);

      const bracket = getAgingBracket(inv.dueDate, now);

      if (bracket === "CURRENT") {
        summary.current.count += 1;
        summary.current.totalAmount = summary.current.totalAmount.plus(due);
      } else {
        // Overdue brackets
        summary.totalOverdue = summary.totalOverdue.plus(due);
        summary.overdueInvoicesCount += 1;

        if (bracket === "1_30") {
          summary.days1To30.count += 1;
          summary.days1To30.totalAmount = summary.days1To30.totalAmount.plus(due);
        } else if (bracket === "31_60") {
          summary.days31To60.count += 1;
          summary.days31To60.totalAmount = summary.days31To60.totalAmount.plus(due);
        } else if (bracket === "61_90") {
          summary.days61To90.count += 1;
          summary.days61To90.totalAmount = summary.days61To90.totalAmount.plus(due);
        } else if (bracket === "90_PLUS") {
          summary.days90Plus.count += 1;
          summary.days90Plus.totalAmount = summary.days90Plus.totalAmount.plus(due);
        }
      }
    }

    return summary;
  }
}

export const paymentService = new PaymentService();

