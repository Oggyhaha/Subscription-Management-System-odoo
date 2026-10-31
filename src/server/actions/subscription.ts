"use server";

import { revalidatePath } from "next/cache";
import { subscriptionService } from "@/server/services/subscription";
import { requireUser } from "@/server/auth/guards";
import {
  createSubscriptionSchema,
  subscriptionActionSchema,
  type CreateSubscriptionInput,
  type SubscriptionActionInput,
} from "@/schemas/subscription";

export interface ActionResult<T = unknown> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}

export async function createSubscriptionAction(input: CreateSubscriptionInput): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const validated = createSubscriptionSchema.parse(input);
    const sub = await subscriptionService.createSubscription(validated, user.id);

    revalidatePath("/admin/subscriptions");
    revalidatePath("/staff/subscriptions");

    return {
      success: true,
      message: `Subscription ${sub.subscriptionNumber} created successfully.`,
      data: sub,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create subscription",
    };
  }
}

export async function transitionSubscriptionAction(input: SubscriptionActionInput): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const validated = subscriptionActionSchema.parse(input);
    const updated = await subscriptionService.transitionState(validated, user.id);

    revalidatePath("/admin/subscriptions");
    revalidatePath("/staff/subscriptions");
    revalidatePath(`/admin/subscriptions/${updated.id}`);
    revalidatePath(`/staff/subscriptions/${updated.id}`);

    return {
      success: true,
      message: `Subscription ${updated.subscriptionNumber} status updated to ${updated.status}.`,
      data: updated,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update subscription status",
    };
  }
}

export async function processAutoClosuresAction(): Promise<ActionResult> {
  try {
    await requireUser();
    const count = await subscriptionService.processAutoClosures();

    revalidatePath("/admin/subscriptions");
    revalidatePath("/staff/subscriptions");

    return {
      success: true,
      message: `Processed ${count} auto-closures.`,
      data: { count },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to process auto closures",
    };
  }
}

