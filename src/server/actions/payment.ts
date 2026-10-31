"use server";

import { revalidatePath } from "next/cache";
import { paymentService } from "@/server/services/payment";
import { requireRole } from "@/server/auth/guards";
import { recordPaymentSchema, type RecordPaymentInput } from "@/schemas/payment";
import type { ActionResult } from "@/server/actions/auth";

/**
 * Server Action: Records a payment against an invoice (ADMIN and STAFF)
 */
export async function recordPaymentAction(input: RecordPaymentInput): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "STAFF"]);
    const validated = recordPaymentSchema.parse(input);

    const result = await paymentService.recordPayment({
      invoiceId: validated.invoiceId,
      amount: validated.amount,
      paymentMethod: validated.paymentMethod,
      paymentDate: validated.paymentDate,
      referenceNote: validated.referenceNote,
      notes: validated.notes,
      userId: user.id,
    });

    revalidatePath("/admin/payments");
    revalidatePath("/staff/payments");
    revalidatePath("/admin/outstanding");
    revalidatePath("/staff/outstanding");
    revalidatePath(`/admin/invoices/${validated.invoiceId}`);
    revalidatePath(`/staff/invoices/${validated.invoiceId}`);

    return {
      success: true,
      message: result.isFullyPaid
        ? `Payment recorded successfully. Invoice #${result.invoice.invoiceNumber} is now fully paid.`
        : `Partial payment of $${Number(validated.amount).toFixed(2)} recorded successfully. Balance remaining: $${Number(result.invoice.amountDue).toFixed(2)}.`,
      data: {
        paymentId: result.payment.id,
        paymentNumber: result.payment.paymentNumber,
        invoiceNumber: result.invoice.invoiceNumber,
        isFullyPaid: result.isFullyPaid,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to record payment";
    return { success: false, error: message };
  }
}

/**
 * Server Action: Retrieves payments list with filters (ADMIN and STAFF)
 */
export async function listPaymentsAction(params?: {
  search?: string;
  invoiceId?: string;
  customerId?: string;
  skip?: number;
  take?: number;
}) {
  try {
    await requireRole(["ADMIN", "STAFF"]);
    return await paymentService.listPayments(params);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load payments";
    throw new Error(message);
  }
}

/**
 * Server Action: Retrieves outstanding invoices with aging (ADMIN and STAFF)
 */
export async function getOutstandingInvoicesAction(params?: {
  search?: string;
  customerId?: string;
  skip?: number;
  take?: number;
}) {
  try {
    await requireRole(["ADMIN", "STAFF"]);
    return await paymentService.getOutstandingInvoices(params);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load outstanding invoices";
    throw new Error(message);
  }
}

/**
 * Server Action: Retrieves aging metrics and overdue summaries (ADMIN and STAFF)
 */
export async function getAgingMetricsAction() {
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const metrics = await paymentService.getAgingMetrics();
    return {
      current: { count: metrics.current.count, totalAmount: metrics.current.totalAmount.toNumber() },
      days1To30: { count: metrics.days1To30.count, totalAmount: metrics.days1To30.totalAmount.toNumber() },
      days31To60: { count: metrics.days31To60.count, totalAmount: metrics.days31To60.totalAmount.toNumber() },
      days61To90: { count: metrics.days61To90.count, totalAmount: metrics.days61To90.totalAmount.toNumber() },
      days90Plus: { count: metrics.days90Plus.count, totalAmount: metrics.days90Plus.totalAmount.toNumber() },
      totalOutstanding: metrics.totalOutstanding.toNumber(),
      totalOverdue: metrics.totalOverdue.toNumber(),
      totalInvoicesCount: metrics.totalInvoicesCount,
      overdueInvoicesCount: metrics.overdueInvoicesCount,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load aging metrics";
    throw new Error(message);
  }
}

