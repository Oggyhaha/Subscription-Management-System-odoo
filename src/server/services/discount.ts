import Decimal from "decimal.js";
import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { toDecimal, roundMoney, addMoney, subtractMoney } from "@/lib/money";
import type {
  DiscountRule,
  DiscountType,
  DiscountScope,
  Prisma,
} from "@prisma/client";
import type {
  DiscountRuleInput,
  DiscountRuleUpdateInput,
  DiscountStatus,
} from "@/schemas/discount";

export interface EvaluatableLine {
  id: string;
  productId?: string | null;
  quantity: number;
  unitPrice: Decimal | number | string;
  lineTotal: Decimal | number | string;
}

export interface LineDiscountAllocation {
  lineId: string;
  productId?: string | null;
  lineTotalBeforeDiscount: Decimal;
  discountAmount: Decimal;
  lineTotalAfterDiscount: Decimal;
}

export interface DiscountEvaluationResult {
  eligible: boolean;
  reason?: string;
  discountRule?: DiscountRule | null;
  totalDiscount: Decimal;
  subtotalBeforeDiscount: Decimal;
  subtotalAfterDiscount: Decimal;
  lineAllocations: LineDiscountAllocation[];
}

/**
 * Computes the lifecycle status of a discount rule based on timestamps and limits
 */
export function computeDiscountStatus(
  rule: {
    isActive: boolean;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    maxUsageCount?: number | null;
    currentUsageCount: number;
  },
  now: Date = new Date()
): DiscountStatus {
  if (!rule.isActive) {
    return "INACTIVE";
  }

  if (
    rule.maxUsageCount !== null &&
    rule.maxUsageCount !== undefined &&
    rule.currentUsageCount >= rule.maxUsageCount
  ) {
    return "EXHAUSTED";
  }

  const evalTime = now.getTime();

  if (rule.endDate && evalTime > new Date(rule.endDate).getTime()) {
    return "EXPIRED";
  }

  if (rule.startDate && evalTime < new Date(rule.startDate).getTime()) {
    return "SCHEDULED";
  }

  return "ACTIVE";
}

/**
 * Core function evaluateDiscounts:
 * Pure business logic for evaluating discount eligibility, calculating proportional
 * line allocations, distributing rounding remainder to the final line, and preventing negative totals.
 */
export function evaluateDiscounts(
  lines: EvaluatableLine[],
  subtotal: Decimal | number | string,
  date: Date = new Date(),
  rule: DiscountRule | null
): DiscountEvaluationResult {
  const subtotalDecimal = toDecimal(subtotal);

  // Default empty result for ineligible states
  const fallbackResult = (reason: string): DiscountEvaluationResult => ({
    eligible: false,
    reason,
    discountRule: rule,
    totalDiscount: new Decimal(0),
    subtotalBeforeDiscount: subtotalDecimal,
    subtotalAfterDiscount: subtotalDecimal,
    lineAllocations: lines.map((line) => ({
      lineId: line.id,
      productId: line.productId,
      lineTotalBeforeDiscount: toDecimal(line.lineTotal),
      discountAmount: new Decimal(0),
      lineTotalAfterDiscount: toDecimal(line.lineTotal),
    })),
  });

  if (!rule) {
    return fallbackResult("No discount rule specified");
  }

  // 1. Check status
  const status = computeDiscountStatus(rule, date);
  if (status === "INACTIVE") {
    return fallbackResult("Discount code is disabled");
  }
  if (status === "EXPIRED") {
    return fallbackResult("Discount code has expired");
  }
  if (status === "SCHEDULED") {
    return fallbackResult("Discount code is not active yet");
  }
  if (status === "EXHAUSTED") {
    return fallbackResult("Discount code has reached its maximum usage limit");
  }

  // 2. Identify eligible lines based on scope
  let eligibleLines: EvaluatableLine[] = [];
  if (rule.scope === "SPECIFIC_PRODUCTS") {
    if (!rule.productId) {
      return fallbackResult("Discount configuration error: missing target product");
    }
    eligibleLines = lines.filter((l) => l.productId === rule.productId);
    if (eligibleLines.length === 0) {
      return fallbackResult("No eligible items for this discount code");
    }
  } else {
    // ENTIRE_SUBSCRIPTION
    eligibleLines = lines;
  }

  // 3. Compute eligible line totals and quantities
  const totalEligibleQuantity = eligibleLines.reduce((sum, l) => sum + l.quantity, 0);
  const totalEligibleAmount = eligibleLines.reduce<Decimal>(
    (sum, l) => sum.plus(toDecimal(l.lineTotal)),
    new Decimal(0)
  );

  if (totalEligibleAmount.lte(0)) {
    return fallbackResult("Eligible items total must be greater than zero");
  }

  // 4. Validate minimum quantity constraint
  if (rule.minQuantity !== null && rule.minQuantity !== undefined) {
    if (totalEligibleQuantity < rule.minQuantity) {
      return fallbackResult(
        `Requires minimum quantity of ${rule.minQuantity} (current: ${totalEligibleQuantity})`
      );
    }
  }

  // 5. Validate minimum purchase amount constraint
  if (rule.minPurchaseAmount !== null && rule.minPurchaseAmount !== undefined) {
    const minAmount = toDecimal(rule.minPurchaseAmount);
    if (totalEligibleAmount.lt(minAmount)) {
      return fallbackResult(
        `Requires minimum purchase of $${minAmount.toFixed(2)} (current eligible: $${totalEligibleAmount.toFixed(2)})`
      );
    }
  }

  // 6. Compute raw discount amount
  let unclippedDiscount = new Decimal(0);
  const ruleValue = toDecimal(rule.value);

  if (rule.type === "PERCENTAGE") {
    // E.g. 15 for 15% (or 0.15 normalized)
    const percentRate = ruleValue.gt(1) ? ruleValue.dividedBy(100) : ruleValue;
    unclippedDiscount = roundMoney(totalEligibleAmount.times(percentRate));
  } else {
    // FIXED_AMOUNT
    unclippedDiscount = roundMoney(ruleValue);
  }

  // Never produce negative totals: clamp discount to eligible amount
  const totalDiscount = Decimal.min(unclippedDiscount, totalEligibleAmount);

  // 7. Proportional allocation across eligible lines, remainder to the last line
  const lineAllocations: LineDiscountAllocation[] = [];
  let allocatedSoFar = new Decimal(0);

  // Process all lines (both eligible and non-eligible)
  const eligibleIndices = lines
    .map((l, index) => (eligibleLines.includes(l) ? index : -1))
    .filter((i) => i !== -1);

  const lastEligibleIndex =
    eligibleIndices.length > 0 ? eligibleIndices[eligibleIndices.length - 1] : -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineTotal = toDecimal(line.lineTotal);

    if (!eligibleLines.includes(line)) {
      // Non-eligible line receives zero discount
      lineAllocations.push({
        lineId: line.id,
        productId: line.productId,
        lineTotalBeforeDiscount: lineTotal,
        discountAmount: new Decimal(0),
        lineTotalAfterDiscount: lineTotal,
      });
      continue;
    }

    let lineDiscount: Decimal;

    if (i === lastEligibleIndex) {
      // Last eligible line absorbs exact penny remainder to prevent floating rounding discrepancies
      lineDiscount = totalDiscount.minus(allocatedSoFar);
    } else {
      const share = lineTotal.dividedBy(totalEligibleAmount);
      lineDiscount = roundMoney(totalDiscount.times(share));
      allocatedSoFar = allocatedSoFar.plus(lineDiscount);
    }

    // Safeguard: line discount cannot exceed line total (no negative line total)
    lineDiscount = Decimal.max(new Decimal(0), Decimal.min(lineDiscount, lineTotal));
    const lineTotalAfterDiscount = subtractMoney(lineTotal, lineDiscount);

    lineAllocations.push({
      lineId: line.id,
      productId: line.productId,
      lineTotalBeforeDiscount: lineTotal,
      discountAmount: lineDiscount,
      lineTotalAfterDiscount,
    });
  }

  const subtotalAfterDiscount = subtractMoney(subtotalDecimal, totalDiscount);

  return {
    eligible: true,
    discountRule: rule,
    totalDiscount,
    subtotalBeforeDiscount: subtotalDecimal,
    subtotalAfterDiscount: Decimal.max(new Decimal(0), subtotalAfterDiscount),
    lineAllocations,
  };
}

export class DiscountService {
  /**
   * Lists discounts with filtering, status calculation, and pagination
   */
  async listDiscounts(params?: {
    search?: string;
    scope?: DiscountScope;
    type?: DiscountType;
    isActive?: boolean;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.DiscountRuleWhereInput = {};

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { code: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params?.scope) {
      where.scope = params.scope;
    }

    if (params?.type) {
      where.type = params.type;
    }

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    const [discounts, total] = await Promise.all([
      db.discountRule.findMany({
        where,
        include: {
          product: {
            select: { id: true, name: true },
          },
          _count: {
            select: { redemptions: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: params?.skip ?? 0,
        take: params?.take ?? 50,
      }),
      db.discountRule.count({ where }),
    ]);

    const formatted = discounts.map((d) => ({
      ...d,
      value: toDecimal(d.value).toNumber(),
      minPurchaseAmount: d.minPurchaseAmount ? toDecimal(d.minPurchaseAmount).toNumber() : null,
      status: computeDiscountStatus(d),
    }));

    return { discounts: formatted, total };
  }

  /**
   * Retrieves a discount rule by unique ID
   */
  async getById(id: string) {
    const discount = await db.discountRule.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true } },
        redemptions: {
          take: 10,
          orderBy: { appliedAt: "desc" },
          include: {
            invoice: { select: { id: true, invoiceNumber: true } },
            subscription: { select: { id: true, subscriptionNumber: true } },
          },
        },
      },
    });

    if (!discount) return null;

    return {
      ...discount,
      status: computeDiscountStatus(discount),
    };
  }

  /**
   * Retrieves active discount rule by code
   */
  async getByCode(code: string) {
    const normalized = code.trim().toUpperCase();
    return db.discountRule.findUnique({
      where: { code: normalized },
      include: { product: true },
    });
  }

  /**
   * Creates a new discount rule (ADMIN only)
   */
  async createDiscountRule(input: DiscountRuleInput): Promise<DiscountRule> {
    const normalizedCode = input.code.trim().toUpperCase();

    const existing = await db.discountRule.findUnique({
      where: { code: normalizedCode },
    });

    if (existing) {
      throw AppError.conflict(`Discount code '${normalizedCode}' already exists`);
    }

    return db.discountRule.create({
      data: {
        name: input.name.trim(),
        code: normalizedCode,
        type: input.type,
        scope: input.scope,
        value: input.value,
        minPurchaseAmount: input.minPurchaseAmount ?? null,
        minQuantity: input.minQuantity ?? null,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        maxUsageCount: input.maxUsageCount ?? null,
        productId: input.scope === "SPECIFIC_PRODUCTS" ? input.productId : null,
        isActive: input.isActive ?? true,
      },
    });
  }

  /**
   * Updates an existing discount rule (ADMIN only)
   */
  async updateDiscountRule(id: string, input: DiscountRuleUpdateInput): Promise<DiscountRule> {
    const existing = await db.discountRule.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound(`Discount rule with ID '${id}' not found`);
    }

    if (input.code && input.code !== existing.code) {
      const codeConflict = await db.discountRule.findUnique({
        where: { code: input.code.trim().toUpperCase() },
      });
      if (codeConflict) {
        throw AppError.conflict(`Discount code '${input.code}' already exists`);
      }
    }

    return db.discountRule.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name.trim() }),
        ...(input.code && { code: input.code.trim().toUpperCase() }),
        ...(input.type && { type: input.type }),
        ...(input.scope && {
          scope: input.scope,
          productId: input.scope === "SPECIFIC_PRODUCTS" ? input.productId : null,
        }),
        ...(input.value !== undefined && { value: input.value }),
        ...(input.minPurchaseAmount !== undefined && {
          minPurchaseAmount: input.minPurchaseAmount ?? null,
        }),
        ...(input.minQuantity !== undefined && { minQuantity: input.minQuantity ?? null }),
        ...(input.startDate !== undefined && { startDate: input.startDate ?? null }),
        ...(input.endDate !== undefined && { endDate: input.endDate ?? null }),
        ...(input.maxUsageCount !== undefined && {
          maxUsageCount: input.maxUsageCount ?? null,
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  }

  /**
   * Toggles active state or archives a discount rule
   */
  async toggleActive(id: string, isActive: boolean): Promise<DiscountRule> {
    return db.discountRule.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * Deletes a discount rule if unredeemed, or archives if redemptions exist
   */
  async deleteDiscountRule(id: string): Promise<{ action: "deleted" | "archived" }> {
    const redemptionsCount = await db.discountRedemption.count({
      where: { discountRuleId: id },
    });

    if (redemptionsCount > 0) {
      await db.discountRule.update({
        where: { id },
        data: { isActive: false },
      });
      return { action: "archived" };
    }

    await db.discountRule.delete({ where: { id } });
    return { action: "deleted" };
  }

  /**
   * Atomically redeems a discount rule under concurrent operations.
   * Uses conditional atomic UPDATE to enforce maxUsageCount without race conditions.
   */
  async redeemDiscount(params: {
    discountId: string;
    appliedAmount: Decimal | number | string;
    invoiceId?: string | null;
    subscriptionId?: string | null;
    tx?: Prisma.TransactionClient;
  }): Promise<{ id: string; appliedAmount: Decimal }> {
    const client = params.tx || db;
    const amount = roundMoney(params.appliedAmount);

    // Atomic conditional increment query
    const rowsAffected = await client.$executeRaw`
      UPDATE discount_rules
      SET current_usage_count = current_usage_count + 1,
          updated_at = NOW()
      WHERE id = ${params.discountId}
        AND is_active = true
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
        AND (max_usage_count IS NULL OR current_usage_count < max_usage_count)
    `;

    if (rowsAffected === 0) {
      throw AppError.badRequest(
        "Discount code cannot be redeemed: it is inactive, expired, or maximum redemption limit has been reached"
      );
    }

    // Record immutable redemption audit entry
    const redemption = await client.discountRedemption.create({
      data: {
        discountRuleId: params.discountId,
        invoiceId: params.invoiceId || null,
        subscriptionId: params.subscriptionId || null,
        appliedAmount: amount,
      },
    });

    return {
      id: redemption.id,
      appliedAmount: amount,
    };
  }
}

export const discountService = new DiscountService();

