"use server";

import { revalidatePath } from "next/cache";
import { discountService, evaluateDiscounts, type EvaluatableLine } from "@/server/services/discount";
import { requireRole } from "@/server/auth/guards";
import { writeAuditLog } from "@/lib/audit";
import {
  discountRuleSchema,
  discountRuleUpdateSchema,
  redeemDiscountSchema,
  type DiscountRuleInput,
  type DiscountRuleUpdateInput,
  type RedeemDiscountInput,
} from "@/schemas/discount";
import type { ActionResult } from "@/server/actions/auth";

/**
 * Creates a new discount rule (ADMIN only)
 */
export async function createDiscountAction(input: DiscountRuleInput): Promise<ActionResult> {
  try {
    const admin = await requireRole("ADMIN");
    const validated = discountRuleSchema.parse(input);

    const discount = await discountService.createDiscountRule(validated);

    await writeAuditLog({
      userId: admin.id,
      action: "DISCOUNT_RULE_CREATED",
      entityType: "DiscountRule",
      entityId: discount.id,
      newState: {
        code: discount.code,
        name: discount.name,
        type: discount.type,
        value: discount.value.toString(),
        scope: discount.scope,
      },
    });

    revalidatePath("/admin/discounts");
    return {
      success: true,
      message: `Discount code '${discount.code}' created successfully`,
      data: discount,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create discount rule";
    return { success: false, error: message };
  }
}

/**
 * Updates an existing discount rule (ADMIN only)
 */
export async function updateDiscountAction(
  id: string,
  input: DiscountRuleUpdateInput
): Promise<ActionResult> {
  try {
    const admin = await requireRole("ADMIN");
    const validated = discountRuleUpdateSchema.parse(input);

    const previous = await discountService.getById(id);
    const updated = await discountService.updateDiscountRule(id, validated);

    await writeAuditLog({
      userId: admin.id,
      action: "DISCOUNT_RULE_UPDATED",
      entityType: "DiscountRule",
      entityId: updated.id,
      oldState: previous ? { code: previous.code, value: previous.value } : null,
      newState: { code: updated.code, value: updated.value.toString() },
    });

    revalidatePath("/admin/discounts");
    return {
      success: true,
      message: `Discount code '${updated.code}' updated successfully`,
      data: updated,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update discount rule";
    return { success: false, error: message };
  }
}

/**
 * Toggles active/archived status of a discount rule (ADMIN only)
 */
export async function toggleDiscountActiveAction(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    const admin = await requireRole("ADMIN");
    const updated = await discountService.toggleActive(id, isActive);

    await writeAuditLog({
      userId: admin.id,
      action: isActive ? "DISCOUNT_RULE_ACTIVATED" : "DISCOUNT_RULE_DEACTIVATED",
      entityType: "DiscountRule",
      entityId: updated.id,
    });

    revalidatePath("/admin/discounts");
    return {
      success: true,
      message: `Discount code '${updated.code}' is now ${isActive ? "active" : "inactive"}`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to toggle discount state";
    return { success: false, error: message };
  }
}

/**
 * Deletes or archives a discount rule (ADMIN only)
 */
export async function deleteDiscountAction(id: string): Promise<ActionResult> {
  try {
    const admin = await requireRole("ADMIN");
    const result = await discountService.deleteDiscountRule(id);

    await writeAuditLog({
      userId: admin.id,
      action: result.action === "deleted" ? "DISCOUNT_RULE_DELETED" : "DISCOUNT_RULE_ARCHIVED",
      entityType: "DiscountRule",
      entityId: id,
    });

    revalidatePath("/admin/discounts");
    return {
      success: true,
      message:
        result.action === "deleted"
          ? "Discount rule deleted successfully"
          : "Discount has existing redemptions and was deactivated instead of deleted",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete discount rule";
    return { success: false, error: message };
  }
}

/**
 * Evaluates discount applicability for quotation or invoice line items (ADMIN & STAFF)
 */
export async function evaluateDiscountAction(params: {
  code: string;
  lines: EvaluatableLine[];
  subtotal: number | string;
  date?: string;
}): Promise<ActionResult> {
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const rule = await discountService.getByCode(params.code);

    if (!rule) {
      return {
        success: false,
        error: `Discount code '${params.code}' not found`,
      };
    }

    const evalDate = params.date ? new Date(params.date) : new Date();
    const evaluation = evaluateDiscounts(params.lines, params.subtotal, evalDate, rule);

    return {
      success: evaluation.eligible,
      error: evaluation.eligible ? undefined : evaluation.reason,
      data: {
        ...evaluation,
        totalDiscount: evaluation.totalDiscount.toNumber(),
        subtotalBeforeDiscount: evaluation.subtotalBeforeDiscount.toNumber(),
        subtotalAfterDiscount: evaluation.subtotalAfterDiscount.toNumber(),
        lineAllocations: evaluation.lineAllocations.map((a) => ({
          ...a,
          lineTotalBeforeDiscount: a.lineTotalBeforeDiscount.toNumber(),
          discountAmount: a.discountAmount.toNumber(),
          lineTotalAfterDiscount: a.lineTotalAfterDiscount.toNumber(),
        })),
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to evaluate discount";
    return { success: false, error: message };
  }
}

/**
 * Redeems a discount atomically against an invoice or subscription (ADMIN & STAFF)
 */
export async function redeemDiscountAction(input: RedeemDiscountInput): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "STAFF"]);
    const validated = redeemDiscountSchema.parse(input);

    const result = await discountService.redeemDiscount({
      discountId: validated.discountId,
      appliedAmount: validated.appliedAmount,
      invoiceId: validated.invoiceId,
      subscriptionId: validated.subscriptionId,
    });

    await writeAuditLog({
      userId: user.id,
      action: "DISCOUNT_REDEEMED",
      entityType: "DiscountRedemption",
      entityId: result.id,
      metadata: {
        discountId: validated.discountId,
        invoiceId: validated.invoiceId,
        appliedAmount: result.appliedAmount.toString(),
      },
    });

    return {
      success: true,
      message: "Discount redeemed successfully",
      data: {
        id: result.id,
        appliedAmount: result.appliedAmount.toNumber(),
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to redeem discount";
    return { success: false, error: message };
  }
}

