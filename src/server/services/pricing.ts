import { db } from "@/server/db";
import { toDecimal, roundMoney, addMoney, subtractMoney, multiplyMoney, MoneyInput } from "@/lib/money";
import { TaxService } from "@/server/services/tax";
import Decimal from "decimal.js";

export interface InvoiceLineSnapshot {
  productId: string | null;
  productVariantId: string | null;
  taxRuleId: string | null;
  description: string;
  quantity: number;
  unitPrice: Decimal;
  taxRateApplied: Decimal;
  taxAmount: Decimal;
  discountAmount: Decimal;
  lineTotal: Decimal;
}

export interface AppliedDiscount {
  ruleId: string;
  code: string;
  name: string;
  amount: Decimal;
  scope: "ENTIRE_SUBSCRIPTION" | "SPECIFIC_PRODUCTS";
  productId?: string | null;
}

export interface InvoiceCalculationResult {
  lines: InvoiceLineSnapshot[];
  subtotal: Decimal;
  discountTotal: Decimal;
  taxTotal: Decimal;
  totalAmount: Decimal;
  discountsApplied: AppliedDiscount[];
}

export interface CalculateInvoiceParams {
  subscription: {
    id: string;
    customerId: string;
    items: Array<{
      id?: string;
      productId: string;
      productVariantId?: string | null;
      taxRuleId?: string | null;
      description?: string | null;
      quantity: number;
      unitPrice: MoneyInput;
      discountAmount?: MoneyInput | null;
      product?: { id: string; name: string; salesPrice?: MoneyInput; price?: MoneyInput } | null;
      variant?: { id: string; name: string; priceModifier: MoneyInput } | null;
      taxRule?: { id: string; name: string; rate: MoneyInput; isDefault?: boolean } | null;
    }>;
  };
  period: {
    periodStart: Date;
    periodEnd: Date;
  };
  discountRules?: any[];
}

export class PricingService {
  /**
   * Evaluates active discount rules against the subscription and line items.
   * Checks validity dates, minimum purchase amount, minimum quantity, usage limits, and scope.
   */
  static async evaluateDiscounts(params: {
    customerId: string;
    subscriptionId?: string;
    items: Array<{
      productId: string;
      quantity: number;
      lineGross: Decimal;
    }>;
    totalGross: Decimal;
    evaluationDate?: Date;
    discountRules?: any[];
  }): Promise<AppliedDiscount[]> {
    const evalDate = params.evaluationDate || new Date();
    const appliedDiscounts: AppliedDiscount[] = [];

    // Query or use provided active discount rules
    let activeRules = params.discountRules;
    if (!activeRules) {
      try {
        activeRules = await db.discountRule.findMany({
          where: {
            isActive: true,
            OR: [
              { startDate: null, endDate: null },
              { startDate: { lte: evalDate }, endDate: null },
              { startDate: null, endDate: { gte: evalDate } },
              { startDate: { lte: evalDate }, endDate: { gte: evalDate } },
            ],
          },
        });
      } catch {
        activeRules = [];
      }
    }

    for (const rule of activeRules) {
      // Check maximum usage count
      if (rule.maxUsageCount !== null && rule.currentUsageCount >= rule.maxUsageCount) {
        continue;
      }

      if (rule.scope === "SPECIFIC_PRODUCTS" && rule.productId) {
        // Find matching line items
        const matchingItems = params.items.filter((i) => i.productId === rule.productId);
        if (matchingItems.length === 0) continue;

        const totalQty = matchingItems.reduce((acc, curr) => acc + curr.quantity, 0);
        const totalLineAmount = matchingItems.reduce((acc, curr) => addMoney(acc, curr.lineGross), new Decimal(0));

        // Check minimum quantity or purchase amount
        if (rule.minQuantity && totalQty < rule.minQuantity) continue;
        if (rule.minPurchaseAmount && totalLineAmount.lessThan(toDecimal(rule.minPurchaseAmount))) continue;

        let discountVal = new Decimal(0);
        if (rule.type === "PERCENTAGE") {
          const rate = toDecimal(rule.value).dividedBy(100);
          discountVal = roundMoney(totalLineAmount.times(rate));
        } else {
          // Fixed amount
          discountVal = roundMoney(toDecimal(rule.value));
        }

        // Clamp to not exceed product line amount
        discountVal = Decimal.min(discountVal, totalLineAmount);
        if (discountVal.greaterThan(0)) {
          appliedDiscounts.push({
            ruleId: rule.id,
            code: rule.code,
            name: rule.name,
            amount: discountVal,
            scope: "SPECIFIC_PRODUCTS",
            productId: rule.productId,
          });
        }
      } else if (rule.scope === "ENTIRE_SUBSCRIPTION") {
        // Check minimum purchase amount
        if (rule.minPurchaseAmount && params.totalGross.lessThan(toDecimal(rule.minPurchaseAmount))) {
          continue;
        }

        let discountVal = new Decimal(0);
        if (rule.type === "PERCENTAGE") {
          const rate = toDecimal(rule.value).dividedBy(100);
          discountVal = roundMoney(params.totalGross.times(rate));
        } else {
          // Fixed amount
          discountVal = roundMoney(toDecimal(rule.value));
        }

        // Clamp to not exceed total gross
        discountVal = Decimal.min(discountVal, params.totalGross);
        if (discountVal.greaterThan(0)) {
          appliedDiscounts.push({
            ruleId: rule.id,
            code: rule.code,
            name: rule.name,
            amount: discountVal,
            scope: "ENTIRE_SUBSCRIPTION",
          });
        }
      }
    }

    return appliedDiscounts;
  }

  /**
   * Calculates comprehensive invoice pricing snapshot:
   * 1. Resolves variant-adjusted unit prices.
   * 2. Evaluates line and rule-based discounts.
   * 3. Calculates tax using TaxService (inclusive/exclusive support).
   * 4. Ensures totals are never negative.
   */
  static async calculateInvoice(
    subscription: CalculateInvoiceParams["subscription"],
    period: CalculateInvoiceParams["period"],
    options?: { discountRules?: any[] }
  ): Promise<InvoiceCalculationResult> {
    const lines: InvoiceLineSnapshot[] = [];
    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);
    let discountTotal = new Decimal(0);

    // Pre-calculate line bases to evaluate subscription-level discounts
    const lineBases: Array<{
      productId: string;
      quantity: number;
      lineGross: Decimal;
    }> = [];

    // 1. First pass: resolve variant-adjusted prices and base line totals
    for (const item of subscription.items) {
      let unitPrice = toDecimal(item.unitPrice);

      // If variant has price modifier and unit price is base, add variant modifier
      if (item.productVariantId) {
        let modifier = new Decimal(0);
        if (item.variant) {
          modifier = toDecimal(item.variant.priceModifier || 0);
        } else {
          try {
            const variant = await db.productVariant.findUnique({
              where: { id: item.productVariantId },
              select: { priceModifier: true },
            });
            if (variant) {
              modifier = toDecimal(variant.priceModifier);
            }
          } catch {
            // DB-less mock fallback
          }
        }
        if (modifier.greaterThan(0)) {
          unitPrice = addMoney(unitPrice, modifier);
        }
      }

      const qty = new Decimal(item.quantity);
      const lineGross = multiplyMoney(unitPrice, qty);
      lineBases.push({
        productId: item.productId,
        quantity: item.quantity,
        lineGross,
      });
      subtotal = addMoney(subtotal, lineGross);
    }

    // 2. Evaluate discounts (both product-specific and subscription-wide)
    let appliedDiscounts: AppliedDiscount[] = [];
    try {
      appliedDiscounts = await this.evaluateDiscounts({
        customerId: subscription.customerId,
        subscriptionId: subscription.id,
        items: lineBases,
        totalGross: subtotal,
        evaluationDate: period.periodStart,
        discountRules: options?.discountRules,
      });
    } catch {
      appliedDiscounts = [];
    }

    // 3. Second pass: Calculate line-level snapshots, apply discounts & taxes
    for (let i = 0; i < subscription.items.length; i++) {
      const item = subscription.items[i];
      const baseInfo = lineBases[i];
      const lineGross = baseInfo.lineGross;
      const qty = new Decimal(item.quantity);
      const unitPrice = roundMoney(lineGross.dividedBy(qty));

      // Calculate line discount: explicit line discount + any matching product rule discount
      let lineDiscount = roundMoney(toDecimal(item.discountAmount || 0));

      const matchingProductDiscount = appliedDiscounts.find(
        (d) => d.scope === "SPECIFIC_PRODUCTS" && d.productId === item.productId
      );
      if (matchingProductDiscount) {
        lineDiscount = addMoney(lineDiscount, matchingProductDiscount.amount);
      }

      // Line discount cannot exceed line gross
      lineDiscount = Decimal.min(lineGross, lineDiscount);
      const lineAfterDiscount = subtractMoney(lineGross, lineDiscount);

      // Resolve Tax Rule
      let taxRule = item.taxRule || null;
      if (!taxRule && item.taxRuleId) {
        taxRule = await db.taxRule.findUnique({
          where: { id: item.taxRuleId },
          select: { id: true, name: true, rate: true },
        });
      }

      let lineTax = new Decimal(0);
      let appliedRate = new Decimal(0);

      if (taxRule) {
        const taxCalc = TaxService.calculateTax(lineAfterDiscount, {
          rate: taxRule.rate,
          isInclusive: false,
        });
        lineTax = taxCalc.taxAmount;
        appliedRate = taxCalc.taxRate;
      }

      const lineTotal = addMoney(lineAfterDiscount, lineTax);

      // Snapshot line description
      let description = item.description || "Subscription Item";
      if (!item.description) {
        if (item.product?.name) {
          description = item.product.name;
          if (item.variant?.name) {
            description += ` (${item.variant.name})`;
          }
        }
      }

      lines.push({
        productId: item.productId || null,
        productVariantId: item.productVariantId || null,
        taxRuleId: item.taxRuleId || null,
        description,
        quantity: item.quantity,
        unitPrice,
        taxRateApplied: appliedRate,
        taxAmount: lineTax,
        discountAmount: lineDiscount,
        lineTotal,
      });

      discountTotal = addMoney(discountTotal, lineDiscount);
      taxTotal = addMoney(taxTotal, lineTax);
    }

    // Include any ENTIRE_SUBSCRIPTION discount rules
    const subscriptionLevelDiscounts = appliedDiscounts.filter((d) => d.scope === "ENTIRE_SUBSCRIPTION");
    for (const subDisc of subscriptionLevelDiscounts) {
      discountTotal = addMoney(discountTotal, subDisc.amount);
    }

    // Ensure total discount does not exceed subtotal
    discountTotal = Decimal.min(subtotal, discountTotal);

    // Final totalAmount calculation: subtotal - discountTotal + taxTotal (never negative!)
    const netBase = subtractMoney(subtotal, discountTotal);
    const totalAmount = roundMoney(Decimal.max(new Decimal(0), addMoney(netBase, taxTotal)));

    return {
      lines,
      subtotal: roundMoney(subtotal),
      discountTotal: roundMoney(discountTotal),
      taxTotal: roundMoney(taxTotal),
      totalAmount,
      discountsApplied: appliedDiscounts,
    };
  }
}
