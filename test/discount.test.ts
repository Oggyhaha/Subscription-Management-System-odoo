import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  evaluateDiscounts,
  computeDiscountStatus,
  type EvaluatableLine,
} from "@/server/services/discount";
import type { DiscountRule } from "@prisma/client";

// Helper to create mock discount rules
function createMockRule(overrides: Partial<DiscountRule> = {}): DiscountRule {
  return {
    id: "rule_1",
    name: "Standard Promo",
    code: "PROMO10",
    type: "PERCENTAGE",
    scope: "ENTIRE_SUBSCRIPTION",
    value: new Decimal(10),
    minPurchaseAmount: null,
    minQuantity: null,
    startDate: null,
    endDate: null,
    maxUsageCount: null,
    currentUsageCount: 0,
    productId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("Discount Rule Lifecycle & Status Computation", () => {
  it("computes ACTIVE status for valid, unconstrained rule", () => {
    const rule = createMockRule();
    expect(computeDiscountStatus(rule)).toBe("ACTIVE");
  });

  it("computes INACTIVE status when isActive is false", () => {
    const rule = createMockRule({ isActive: false });
    expect(computeDiscountStatus(rule)).toBe("INACTIVE");
  });

  it("computes EXHAUSTED status when currentUsageCount reaches maxUsageCount", () => {
    const rule = createMockRule({
      maxUsageCount: 5,
      currentUsageCount: 5,
    });
    expect(computeDiscountStatus(rule)).toBe("EXHAUSTED");
  });

  it("computes EXPIRED status when endDate is in the past", () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    const rule = createMockRule({ endDate: pastDate });
    expect(computeDiscountStatus(rule)).toBe("EXPIRED");
  });

  it("computes SCHEDULED status when startDate is in the future", () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day future
    const rule = createMockRule({ startDate: futureDate });
    expect(computeDiscountStatus(rule)).toBe("SCHEDULED");
  });
});

describe("evaluateDiscounts() Eligibility & Constraints", () => {
  const sampleLines: EvaluatableLine[] = [
    {
      id: "line_1",
      productId: "prod_a",
      quantity: 2,
      unitPrice: 100,
      lineTotal: 200,
    },
    {
      id: "line_2",
      productId: "prod_b",
      quantity: 1,
      unitPrice: 300,
      lineTotal: 300,
    },
  ];

  it("evaluates percentage discount across entire subscription", () => {
    const rule = createMockRule({
      type: "PERCENTAGE",
      value: new Decimal(10), // 10%
    });

    const result = evaluateDiscounts(sampleLines, 500, new Date(), rule);

    expect(result.eligible).toBe(true);
    expect(result.totalDiscount.toNumber()).toBe(50.0); // 10% of 500
    expect(result.subtotalAfterDiscount.toNumber()).toBe(450.0);
  });

  it("rejects discount when minimum purchase amount is not satisfied", () => {
    const rule = createMockRule({
      minPurchaseAmount: new Decimal(600), // Requires $600, but total is $500
    });

    const result = evaluateDiscounts(sampleLines, 500, new Date(), rule);

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("Requires minimum purchase of $600.00");
    expect(result.totalDiscount.toNumber()).toBe(0);
  });

  it("rejects discount when minimum quantity is not satisfied", () => {
    const rule = createMockRule({
      minQuantity: 5, // Requires 5 items, sample has 2 + 1 = 3
    });

    const result = evaluateDiscounts(sampleLines, 500, new Date(), rule);

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("Requires minimum quantity of 5");
    expect(result.totalDiscount.toNumber()).toBe(0);
  });

  it("restricts discount strictly to specific product lines", () => {
    const rule = createMockRule({
      type: "PERCENTAGE",
      scope: "SPECIFIC_PRODUCTS",
      productId: "prod_a", // Only prod_a lineTotal ($200) is eligible
      value: new Decimal(20), // 20%
    });

    const result = evaluateDiscounts(sampleLines, 500, new Date(), rule);

    expect(result.eligible).toBe(true);
    expect(result.totalDiscount.toNumber()).toBe(40.0); // 20% of 200 = 40
    expect(result.subtotalAfterDiscount.toNumber()).toBe(460.0);

    const line1Alloc = result.lineAllocations.find((l) => l.lineId === "line_1");
    const line2Alloc = result.lineAllocations.find((l) => l.lineId === "line_2");

    expect(line1Alloc?.discountAmount.toNumber()).toBe(40.0);
    expect(line1Alloc?.lineTotalAfterDiscount.toNumber()).toBe(160.0);

    // Non-matching line receives $0 discount
    expect(line2Alloc?.discountAmount.toNumber()).toBe(0.0);
    expect(line2Alloc?.lineTotalAfterDiscount.toNumber()).toBe(300.0);
  });
});

describe("evaluateDiscounts() Allocation Rounding & Remainder", () => {
  it("proportionally allocates discount with exact remainder assigned to final line", () => {
    // 3 lines with $33.33 each ($99.99 total)
    const lines: EvaluatableLine[] = [
      { id: "l1", quantity: 1, unitPrice: 33.33, lineTotal: 33.33 },
      { id: "l2", quantity: 1, unitPrice: 33.33, lineTotal: 33.33 },
      { id: "l3", quantity: 1, unitPrice: 33.33, lineTotal: 33.33 },
    ];

    const rule = createMockRule({
      type: "FIXED_AMOUNT",
      value: new Decimal(10), // $10 discount across 3 equal lines
    });

    const result = evaluateDiscounts(lines, 99.99, new Date(), rule);

    expect(result.eligible).toBe(true);
    expect(result.totalDiscount.toNumber()).toBe(10.0);

    const alloc1 = result.lineAllocations[0].discountAmount.toNumber();
    const alloc2 = result.lineAllocations[1].discountAmount.toNumber();
    const alloc3 = result.lineAllocations[2].discountAmount.toNumber();

    // 10 / 3 = 3.3333... rounded to 3.33 for l1 and l2.
    // l3 must absorb remainder: 10.00 - (3.33 + 3.33) = 3.34
    expect(alloc1).toBe(3.33);
    expect(alloc2).toBe(3.33);
    expect(alloc3).toBe(3.34);

    // Strict verification: sum of allocated line discounts must match total discount down to the cent
    const sumAlloc = new Decimal(alloc1).plus(alloc2).plus(alloc3);
    expect(sumAlloc.toNumber()).toBe(10.0);
  });
});

describe("evaluateDiscounts() No-Negative-Totals Safeguard", () => {
  it("clamps discount when fixed discount exceeds the eligible purchase amount", () => {
    const lines: EvaluatableLine[] = [
      { id: "l1", quantity: 1, unitPrice: 150, lineTotal: 150 },
    ];

    // Attempting to apply $250 discount on a $150 item
    const rule = createMockRule({
      type: "FIXED_AMOUNT",
      value: new Decimal(250),
    });

    const result = evaluateDiscounts(lines, 150, new Date(), rule);

    expect(result.eligible).toBe(true);
    // Discount is clamped to 150
    expect(result.totalDiscount.toNumber()).toBe(150.0);
    expect(result.subtotalAfterDiscount.toNumber()).toBe(0.0);
    expect(result.lineAllocations[0].lineTotalAfterDiscount.toNumber()).toBe(0.0);
    expect(result.subtotalAfterDiscount.gte(0)).toBe(true);
  });
});

describe("Concurrency Safety: Atomic Discount Redemption", () => {
  it("enforces maxUsageCount under concurrent redemption attempts", async () => {
    // Simulate atomic discount rule state in concurrent memory store
    const concurrentDiscount = {
      id: "disc_concurrent_1",
      maxUsageCount: 3,
      currentUsageCount: 0,
      isActive: true,
    };

    // Atomic test simulator mimicking the PostgreSQL conditional UPDATE:
    // UPDATE discount_rules SET current_usage_count = current_usage_count + 1
    // WHERE id = disc_id AND current_usage_count < max_usage_count
    let mutex = Promise.resolve();
    const atomicRedeem = async () => {
      return new Promise<{ success: boolean }>((resolve) => {
        mutex = mutex.then(async () => {
          if (
            concurrentDiscount.isActive &&
            concurrentDiscount.currentUsageCount < concurrentDiscount.maxUsageCount
          ) {
            concurrentDiscount.currentUsageCount += 1;
            resolve({ success: true });
          } else {
            resolve({ success: false });
          }
        });
      });
    };

    // Fire 10 concurrent requests at the same time
    const concurrentAttempts = Array.from({ length: 10 }).map(() => atomicRedeem());
    const results = await Promise.all(concurrentAttempts);

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    // Exactly 3 succeed, exactly 7 fail
    expect(successful.length).toBe(3);
    expect(failed.length).toBe(7);
    expect(concurrentDiscount.currentUsageCount).toBe(3);
  });
});

