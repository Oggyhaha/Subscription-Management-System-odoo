"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/guards";
import {
  customerPortalService,
  resolveCustomerId,
} from "@/server/services/customer-portal";
import {
  customerProfileUpdateSchema,
  changePasswordSchema,
  type CustomerProfileUpdateInput,
  type ChangePasswordInput,
} from "@/schemas/portal";
import type { ActionResult } from "@/server/actions/auth";

/**
 * Helper to authenticate caller as CUSTOMER and securely resolve their tenant Customer ID.
 */
async function getAuthCustomer() {
  const user = await requireRole(["CUSTOMER"]);
  const customerId = await resolveCustomerId(user.id, user.customerProfileId);
  return { user, customerId };
}

/**
 * 1. Customer Dashboard Overview
 */
export async function getCustomerDashboardAction(): Promise<ActionResult> {
  try {
    const { customerId } = await getAuthCustomer();
    const summary = await customerPortalService.getDashboardSummary(customerId);
    return { success: true, data: summary };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard overview";
    return { success: false, error: message };
  }
}

/**
 * 2. List Customer Subscriptions
 */
export async function getCustomerSubscriptionsAction(): Promise<ActionResult> {
  try {
    const { customerId } = await getAuthCustomer();
    const subscriptions = await customerPortalService.listSubscriptions(customerId);
    return { success: true, data: subscriptions };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load subscriptions";
    return { success: false, error: message };
  }
}

/**
 * 3. Subscription Details
 */
export async function getCustomerSubscriptionDetailsAction(
  subscriptionId: string
): Promise<ActionResult> {
  try {
    const { customerId } = await getAuthCustomer();
    const details = await customerPortalService.getSubscriptionDetails(customerId, subscriptionId);
    return { success: true, data: details };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load subscription details";
    return { success: false, error: message };
  }
}

/**
 * 4. Pause Subscription
 */
export async function pauseCustomerSubscriptionAction(
  subscriptionId: string
): Promise<ActionResult> {
  try {
    const { user, customerId } = await getAuthCustomer();
    const updated = await customerPortalService.pauseSubscription(
      customerId,
      subscriptionId,
      user.id
    );

    revalidatePath("/customer");
    revalidatePath("/customer/subscriptions");
    revalidatePath(`/customer/subscriptions/${subscriptionId}`);

    return {
      success: true,
      message: "Your subscription has been paused successfully",
      data: updated,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to pause subscription";
    return { success: false, error: message };
  }
}

/**
 * 5. Resume Subscription
 */
export async function resumeCustomerSubscriptionAction(
  subscriptionId: string
): Promise<ActionResult> {
  try {
    const { user, customerId } = await getAuthCustomer();
    const updated = await customerPortalService.resumeSubscription(
      customerId,
      subscriptionId,
      user.id
    );

    revalidatePath("/customer");
    revalidatePath("/customer/subscriptions");
    revalidatePath(`/customer/subscriptions/${subscriptionId}`);

    return {
      success: true,
      message: "Your subscription has been resumed and is now active",
      data: updated,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to resume subscription";
    return { success: false, error: message };
  }
}

/**
 * 6. Renew Subscription
 */
export async function renewCustomerSubscriptionAction(
  subscriptionId: string
): Promise<ActionResult> {
  try {
    const { user, customerId } = await getAuthCustomer();
    const updated = await customerPortalService.renewSubscription(
      customerId,
      subscriptionId,
      user.id
    );

    revalidatePath("/customer");
    revalidatePath("/customer/subscriptions");
    revalidatePath(`/customer/subscriptions/${subscriptionId}`);

    return {
      success: true,
      message: "Subscription renewed successfully for the next billing interval",
      data: updated,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to renew subscription";
    return { success: false, error: message };
  }
}

/**
 * 7. List Customer Invoices
 */
export async function getCustomerInvoicesAction(params?: {
  status?: string;
  skip?: number;
  take?: number;
}): Promise<ActionResult> {
  try {
    const { customerId } = await getAuthCustomer();
    const result = await customerPortalService.listInvoices(customerId, params);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load invoices";
    return { success: false, error: message };
  }
}

/**
 * 8. Invoice Details
 */
export async function getCustomerInvoiceDetailsAction(invoiceId: string): Promise<ActionResult> {
  try {
    const { customerId } = await getAuthCustomer();
    const invoice = await customerPortalService.getInvoiceDetails(customerId, invoiceId);
    return { success: true, data: invoice };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load invoice details";
    return { success: false, error: message };
  }
}

/**
 * 9. List Customer Payments
 */
export async function getCustomerPaymentsAction(params?: {
  skip?: number;
  take?: number;
}): Promise<ActionResult> {
  try {
    const { customerId } = await getAuthCustomer();
    const result = await customerPortalService.listPayments(customerId, params);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load payments ledger";
    return { success: false, error: message };
  }
}

/**
 * 10. Get Profile Details
 */
export async function getCustomerProfileAction(): Promise<ActionResult> {
  try {
    const { customerId } = await getAuthCustomer();
    const profile = await customerPortalService.getProfile(customerId);
    return { success: true, data: profile };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load account profile";
    return { success: false, error: message };
  }
}

/**
 * 11. Update Profile Information & Billing Address
 */
export async function updateCustomerProfileAction(
  input: CustomerProfileUpdateInput
): Promise<ActionResult> {
  try {
    const { customerId } = await getAuthCustomer();
    const validated = customerProfileUpdateSchema.parse(input);
    const updated = await customerPortalService.updateProfile(customerId, validated);

    revalidatePath("/customer/settings");
    return {
      success: true,
      message: "Billing profile updated successfully",
      data: updated,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update profile";
    return { success: false, error: message };
  }
}

/**
 * 12. Change Password
 */
export async function changeCustomerPasswordAction(
  input: ChangePasswordInput
): Promise<ActionResult> {
  try {
    const { user } = await getAuthCustomer();
    const validated = changePasswordSchema.parse(input);

    await customerPortalService.changePassword(
      user.id,
      validated.currentPassword,
      validated.newPassword
    );

    return {
      success: true,
      message: "Password changed successfully. Please keep your credentials secure.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to change password";
    return { success: false, error: message };
  }
}

