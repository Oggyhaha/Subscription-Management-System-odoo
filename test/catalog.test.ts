import { describe, it, expect } from "vitest";
import { ProductService } from "@/server/services/product";
import { TaxService } from "@/server/services/tax";
import {
  productSchema,
  planSchema,
  taxRuleSchema,
  customerProfileSchema,
} from "@/schemas/catalog";
import Decimal from "decimal.js";

describe("ProductService - Variant & Effective Price Calculations", () => {
  it("calculates effective unit price: base price + variant adjustment (e.g. 2,000 + 560 = 2,560)", () => {
    const basePrice = 2000;
    const variantAdjustment = 560;

    const effective = ProductService.calculateEffectivePrice(basePrice, variantAdjustment);
    expect(effective.toNumber()).toBe(2560);
    expect(effective.toFixed(2)).toBe("2560.00");
  });

  it("handles zero adjustment correctly", () => {
    const effective = ProductService.calculateEffectivePrice(150, 0);
    expect(effective.toNumber()).toBe(150);
  });

  it("handles negative variant adjustment (e.g. discount or lite edition)", () => {
    const effective = ProductService.calculateEffectivePrice(1000, -150);
    expect(effective.toNumber()).toBe(850);
  });

  it("preserves high precision with Decimal string inputs", () => {
    const effective = ProductService.calculateEffectivePrice("99.99", "12.50");
    expect(effective.toFixed(2)).toBe("112.49");
  });
});

describe("TaxService - Configurable Tax Calculations", () => {
  it("calculates exclusive tax correctly (100 @ 10% => tax 10.00, total 110.00)", () => {
    const result = TaxService.calculateTax(100, {
      rate: 0.10,
      isInclusive: false,
    });

    expect(result.taxableAmount.toFixed(2)).toBe("100.00");
    expect(result.taxAmount.toFixed(2)).toBe("10.00");
    expect(result.totalWithTax.toFixed(2)).toBe("110.00");
    expect(result.isInclusive).toBe(false);
  });

  it("calculates inclusive tax correctly (110 gross @ 10% => tax 10.00, net 100.00)", () => {
    const result = TaxService.calculateTax(110, {
      rate: 0.10,
      isInclusive: true,
    });

    expect(result.taxAmount.toFixed(2)).toBe("10.00");
    expect(result.taxableAmount.toFixed(2)).toBe("100.00");
    expect(result.totalWithTax.toFixed(2)).toBe("110.00");
    expect(result.isInclusive).toBe(true);
  });

  it("normalizes rate given as whole percentage (e.g. 15 for 15%)", () => {
    const result = TaxService.calculateTax(200, {
      rate: 15,
      isInclusive: false,
    });

    expect(result.taxRate.toNumber()).toBe(0.15);
    expect(result.taxAmount.toFixed(2)).toBe("30.00");
    expect(result.totalWithTax.toFixed(2)).toBe("230.00");
  });

  it("returns zero tax when rate is 0 or negative", () => {
    const result = TaxService.calculateTax(500, { rate: 0 });
    expect(result.taxAmount.toNumber()).toBe(0);
    expect(result.totalWithTax.toFixed(2)).toBe("500.00");
  });

  it("applies banker-safe ROUND_HALF_UP rounding policy", () => {
    // 33.33 * 0.0825 = 2.749725 => rounds to 2.75
    const result = TaxService.calculateTax("33.33", { rate: 0.0825 });
    expect(result.taxAmount.toFixed(2)).toBe("2.75");
    expect(result.totalWithTax.toFixed(2)).toBe("36.08");
  });
});

describe("Zod Catalog Validation Schemas", () => {
  it("validates valid product payload", () => {
    const valid = productSchema.safeParse({
      name: "Brightloop Analytics Suite",
      type: "SOFTWARE",
      salesPrice: "199.99",
      costPrice: "50.00",
      notes: "Cloud SaaS edition",
      isActive: true,
    });
    expect(valid.success).toBe(true);
  });

  it("rejects negative sales price in productSchema", () => {
    const invalid = productSchema.safeParse({
      name: "Test Product",
      salesPrice: -50,
      costPrice: 10,
    });
    expect(invalid.success).toBe(false);
  });

  it("validates planSchema with valid date range", () => {
    const valid = planSchema.safeParse({
      name: "Enterprise Annual",
      code: "ENT-ANNUAL",
      price: "1200.00",
      billingInterval: "YEARLY",
      minQuantity: 5,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      autoCloseAtEnd: true,
    });
    expect(valid.success).toBe(true);
  });

  it("rejects planSchema when endDate is before startDate", () => {
    const invalid = planSchema.safeParse({
      name: "Broken Plan",
      code: "BROKEN",
      price: "100.00",
      startDate: "2026-12-31",
      endDate: "2026-01-01",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates customerProfileSchema with valid email", () => {
    const valid = customerProfileSchema.safeParse({
      name: "Acme Corp",
      email: "billing@acme.com",
      country: "US",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects customerProfileSchema with invalid email", () => {
    const invalid = customerProfileSchema.safeParse({
      name: "Acme Corp",
      email: "not-an-email",
    });
    expect(invalid.success).toBe(false);
  });
});

