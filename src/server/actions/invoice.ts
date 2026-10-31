"use server";

import { revalidatePath } from "next/cache";
import { InvoiceService } from "@/server/services/invoice";
import { requireUser } from "@/server/auth/guards";
import {
  generateInvoiceSchema,
  invoiceActionSchema,
  sendInvoiceSchema,
  type GenerateInvoiceInput,
  type InvoiceActionInput,
  type SendInvoiceInput,
} from "@/schemas/invoice";

export interface ActionResult<T = unknown> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}

/**
 * Generates an invoice from an active/confirmed subscription
 */
export async function generateInvoiceAction(input: GenerateInvoiceInput): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const validated = generateInvoiceSchema.parse(input);

    const now = new Date();
    const periodStart = validated.periodStart ? new Date(validated.periodStart) : now;
    const periodEnd = validated.periodEnd ? new Date(validated.periodEnd) : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const invoice = await InvoiceService.generateInvoice(
      validated.subscriptionId,
      periodStart,
      periodEnd,
      {
        createdById: user.id,
        autoSendEmail: false,
      }
    );

    revalidatePath("/admin/invoices");
    revalidatePath("/staff/invoices");
    revalidatePath(`/admin/subscriptions/${validated.subscriptionId}`);
    revalidatePath(`/staff/subscriptions/${validated.subscriptionId}`);

    return {
      success: true,
      message: `Invoice ${invoice.invoiceNumber} generated successfully.`,
      data: invoice,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate invoice",
    };
  }
}

/**
 * Handles invoice state transitions: CONFIRM, CANCEL, MARK_PAID, SEND
 */
export async function executeInvoiceAction(input: InvoiceActionInput): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const validated = invoiceActionSchema.parse(input);

    let updatedInvoice: any;

    switch (validated.action) {
      case "CONFIRM":
        updatedInvoice = await InvoiceService.confirmInvoice(validated.invoiceId, user.id);
        break;

      case "CANCEL":
        updatedInvoice = await InvoiceService.cancelInvoice(validated.invoiceId, validated.reason || undefined, user.id);
        break;

      case "MARK_PAID":
        updatedInvoice = await InvoiceService.markPaid(
          validated.invoiceId,
          validated.amount,
          validated.paymentMethod,
          user.id
        );
        break;

      case "SEND":
        const emailRes = await InvoiceService.sendInvoiceEmail(validated.invoiceId);
        if (!emailRes.success) {
          return {
            success: false,
            error: emailRes.error || "Email delivery failed",
          };
        }
        updatedInvoice = await InvoiceService.getInvoiceById(validated.invoiceId);
        break;

      default:
        return { success: false, error: "Invalid action" };
    }

    revalidatePath("/admin/invoices");
    revalidatePath("/staff/invoices");
    revalidatePath(`/admin/invoices/${validated.invoiceId}`);
    revalidatePath(`/staff/invoices/${validated.invoiceId}`);

    return {
      success: true,
      message: `Invoice action ${validated.action} executed successfully.`,
      data: updatedInvoice,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to execute invoice action",
    };
  }
}

/**
 * Sends an invoice email to the customer or custom recipient
 */
export async function sendInvoiceEmailAction(input: SendInvoiceInput): Promise<ActionResult> {
  try {
    await requireUser();
    const validated = sendInvoiceSchema.parse(input);

    const emailRes = await InvoiceService.sendInvoiceEmail(validated.invoiceId, validated.recipientEmail);

    if (!emailRes.success) {
      return {
        success: false,
        error: emailRes.error || "Email delivery failed",
      };
    }

    revalidatePath(`/admin/invoices/${validated.invoiceId}`);
    revalidatePath(`/staff/invoices/${validated.invoiceId}`);

    return {
      success: true,
      message: "Invoice email sent successfully.",
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send invoice email",
    };
  }
}

