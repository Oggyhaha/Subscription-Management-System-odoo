"use server";

import { revalidatePath } from "next/cache";
import { BillingService, type BillingRunSummary, type BillingRunResultItem } from "@/server/services/billing";
import { OutboxService, type OutboxProcessResult } from "@/server/services/outbox";
import { requireUser, requireRole } from "@/server/auth/guards";

export interface ActionResult<T = unknown> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}

/**
 * Triggers a manual batch billing run for all active subscriptions due
 */
export async function triggerManualBillingRunAction(): Promise<ActionResult<BillingRunSummary>> {
  try {
    const user = await requireRole(["ADMIN", "STAFF"]);

    const summary = await BillingService.runDueBilling(new Date(), {
      triggeredBy: user.id,
    });

    revalidatePath("/admin/billing-runs");
    revalidatePath("/admin/invoices");
    revalidatePath("/staff/invoices");
    revalidatePath("/admin/outstanding");
    revalidatePath("/staff/outstanding");

    return {
      success: true,
      message: `Billing run finished: ${summary.created} invoices created, ${summary.skipped} skipped, ${summary.failed} failed.`,
      data: summary,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to execute manual billing run",
    };
  }
}

/**
 * Retries billing generation for a single failed subscription
 */
export async function retrySubscriptionBillingAction(
  subscriptionId: string
): Promise<ActionResult<BillingRunResultItem>> {
  try {
    const user = await requireRole(["ADMIN", "STAFF"]);

    const result = await BillingService.retrySubscriptionBilling(subscriptionId, user.id);

    revalidatePath("/admin/billing-runs");
    revalidatePath("/admin/invoices");
    revalidatePath("/staff/invoices");

    if (result.status === "FAILED") {
      return {
        success: false,
        error: result.error || "Retry failed",
        data: result,
      };
    }

    return {
      success: true,
      message: `Invoice ${result.invoiceNumber} created for subscription ${result.subscriptionNumber}.`,
      data: result,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to retry billing cycle",
    };
  }
}

/**
 * Flushes pending and retriable outbox emails
 */
export async function flushEmailOutboxAction(): Promise<ActionResult<OutboxProcessResult>> {
  try {
    await requireRole(["ADMIN", "STAFF"]);

    const result = await OutboxService.processOutbox({ batchSize: 50 });

    revalidatePath("/admin/billing-runs");

    return {
      success: true,
      message: `Outbox processed: ${result.sent} emails sent, ${result.failed} failed.`,
      data: result,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to process outbox",
    };
  }
}

