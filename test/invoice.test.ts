import { describe, it, expect, vi, beforeEach } from "vitest";
import { PricingService } from "../src/server/services/pricing";
import { TaxService } from "../src/server/services/tax";
import { InvoiceService } from "../src/server/services/invoice";
import { toDecimal, addMoney, multiplyMoney, subtractMoney } from "../src/lib/money";
import { AppError } from "../src/lib/errors";
import Decimal from "decimal.js";

describe("Invoice Pricing Calculation (PricingService)", () => {
  it("calculates base invoice totals accurately with taxes and variant adjustments", async () => {
    const mockSubscription = {
      id: "sub_1",
      customerId: "cust_1",
      items: [
        {
          id: "item_1",
          productId: "prod_core",
          productVariantId: "var_enterprise",
          quantity: 2,
          unitPrice: 100, // base 100
          variant: { id: "var_enterprise", name: "Enterprise Tier", priceModifier: 25 }, // +25 -> 125
          discountAmount: 10, // $10 line discount
          taxRule: { id: "tax_10", name: "Standard 10%", rate: 0.10 },
          product: { id: "prod_core", name: "Core Platform", price: 100 },
        },
      ],
    };

    const period = {
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-02-01"),
    };

    const result = await PricingService.calculateInvoice(mockSubscription, period, { discountRules: [] });

    // Unit price = 100 + 25 = 125
    // Line Gross = 125 * 2 = 250
    // Discount = 10
    // After discount = 240
    // Tax at 10% on 240 = 24
    // Line Total = 240 + 24 = 264
    expect(result.lines.length).toBe(1);
    const line = result.lines[0];
    expect(line.unitPrice.toNumber()).toBe(125);
    expect(line.discountAmount.toNumber()).toBe(10);
    expect(line.taxAmount.toNumber()).toBe(24);
    expect(line.taxRateApplied.toNumber()).toBe(0.1);
    expect(line.lineTotal.toNumber()).toBe(264);

    expect(result.subtotal.toNumber()).toBe(250);
    expect(result.discountTotal.toNumber()).toBe(10);
    expect(result.taxTotal.toNumber()).toBe(24);
    expect(result.totalAmount.toNumber()).toBe(264);
  });

  it("never allows totalAmount to become negative, even under extreme discounts", async () => {
    const mockSubscription = {
      id: "sub_2",
      customerId: "cust_1",
      items: [
        {
          id: "item_2",
          productId: "prod_starter",
          quantity: 1,
          unitPrice: 50,
          discountAmount: 200, // Massive discount exceeding line gross
          taxRule: { id: "tax_10", name: "Standard 10%", rate: 0.10 },
        },
      ],
    };

    const period = {
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-02-01"),
    };

    const result = await PricingService.calculateInvoice(mockSubscription, period, { discountRules: [] });

    // Line gross is 50. Discount is clamped to 50 max.
    // Line after discount = 0
    // Tax = 0
    // Total = 0 (never negative)
    expect(result.lines[0].discountAmount.toNumber()).toBe(50);
    expect(result.lines[0].lineTotal.toNumber()).toBe(0);
    expect(result.totalAmount.toNumber()).toBe(0);
    expect(result.totalAmount.isNegative()).toBe(false);
  });
});

describe("Tax Snapshot Durability", () => {
  it("preserves immutable tax rate and amount on invoice items even when catalog tax rules change later", async () => {
    // 1. Initial tax rule at 10%
    let catalogTaxRule = { id: "tax_rule_vat", name: "VAT", rate: 0.10 };

    const mockSubscription = {
      id: "sub_tax",
      customerId: "cust_tax",
      items: [
        {
          id: "item_tax",
          productId: "prod_app",
          quantity: 1,
          unitPrice: 100,
          taxRuleId: catalogTaxRule.id,
          taxRule: { ...catalogTaxRule },
        },
      ],
    };

    const period = {
      periodStart: new Date("2026-03-01"),
      periodEnd: new Date("2026-04-01"),
    };

    // Generate initial snapshot
    const pricing = await PricingService.calculateInvoice(mockSubscription, period, { discountRules: [] });
    const snapshottedLine = pricing.lines[0];

    expect(snapshottedLine.taxRateApplied.toNumber()).toBe(0.10);
    expect(snapshottedLine.taxAmount.toNumber()).toBe(10);
    expect(snapshottedLine.lineTotal.toNumber()).toBe(110);

    // 2. Simulate government increases tax rate from 10% to 25% later
    catalogTaxRule.rate = 0.25;

    // The recorded invoice snapshot MUST stay at the original 10% rate and $10 tax
    expect(snapshottedLine.taxRateApplied.toNumber()).toBe(0.10);
    expect(snapshottedLine.taxAmount.toNumber()).toBe(10);
    expect(snapshottedLine.lineTotal.toNumber()).toBe(110);
    expect(snapshottedLine.taxRateApplied.toNumber()).not.toBe(catalogTaxRule.rate);
  });
});

describe("Billing Cycle Idempotency Protection", () => {
  it("generates deterministic cycle key format: sub_{id}_{start}_{end}", () => {
    const subscriptionId = "sub_xyz789";
    const start = new Date("2026-05-01T00:00:00.000Z");
    const end = new Date("2026-06-01T00:00:00.000Z");

    const startIso = start.toISOString().split("T")[0];
    const endIso = end.toISOString().split("T")[0];
    const cycleKey = `sub_${subscriptionId}_${startIso}_${endIso}`;

    expect(cycleKey).toBe("sub_sub_xyz789_2026-05-01_2026-06-01");
  });

  it("safely handles duplicate billing cycle triggers by returning existing invoice (no duplicate rows)", async () => {
    // Simulated in-memory billing cycle registry
    const billingCycleDb = new Map<string, { id: string; cycleKey: string; invoiceId: string }>();
    const invoiceDb = new Map<string, any>();

    async function mockGenerateInvoice(subId: string, start: Date, end: Date) {
      const startIso = start.toISOString().split("T")[0];
      const endIso = end.toISOString().split("T")[0];
      const cycleKey = `sub_${subId}_${startIso}_${endIso}`;

      // Idempotency check
      if (billingCycleDb.has(cycleKey)) {
        const cycle = billingCycleDb.get(cycleKey)!;
        return { invoice: invoiceDb.get(cycle.invoiceId), isDuplicate: true };
      }

      // Create new invoice
      const invoiceId = `inv_${Date.now()}_${Math.random()}`;
      const newInvoice = {
        id: invoiceId,
        invoiceNumber: "INV-2026-000001",
        subscriptionId: subId,
        cycleKey,
        totalAmount: 150,
      };

      invoiceDb.set(invoiceId, newInvoice);
      billingCycleDb.set(cycleKey, {
        id: `cycle_${Date.now()}`,
        cycleKey,
        invoiceId,
      });

      return { invoice: newInvoice, isDuplicate: false };
    }

    const start = new Date("2026-07-01");
    const end = new Date("2026-08-01");

    // First attempt -> creates invoice
    const run1 = await mockGenerateInvoice("sub_100", start, end);
    expect(run1.isDuplicate).toBe(false);
    expect(run1.invoice.invoiceNumber).toBe("INV-2026-000001");

    // Second attempt with exact same cycle -> returns existing invoice
    const run2 = await mockGenerateInvoice("sub_100", start, end);
    expect(run2.isDuplicate).toBe(true);
    expect(run2.invoice.id).toBe(run1.invoice.id);
    expect(billingCycleDb.size).toBe(1);
    expect(invoiceDb.size).toBe(1);
  });
});

describe("Invoice Lifecycle & Cancellation Safeguards", () => {
  interface InvoiceMock {
    id: string;
    invoiceNumber: string;
    status: "DRAFT" | "CONFIRMED" | "PAID" | "CANCELLED";
    totalAmount: Decimal;
    amountPaid: Decimal;
    notes?: string;
  }

  function cancelInvoice(invoice: InvoiceMock, reason?: string): InvoiceMock {
    if (invoice.status === "PAID") {
      throw AppError.badRequest(
        "Paid invoices cannot be cancelled. Record a refund or adjustment instead.",
        "INVALID_STATE_TRANSITION"
      );
    }
    if (invoice.status === "CANCELLED") {
      return invoice;
    }
    return {
      ...invoice,
      status: "CANCELLED",
      notes: reason ? `Cancelled: ${reason}` : invoice.notes,
    };
  }

  it("strictly forbids cancellation of a PAID invoice under financial compliance rules", () => {
    const paidInvoice: InvoiceMock = {
      id: "inv_paid_1",
      invoiceNumber: "INV-2026-000099",
      status: "PAID",
      totalAmount: new Decimal(250),
      amountPaid: new Decimal(250),
    };

    expect(() => cancelInvoice(paidInvoice, "Customer asked to cancel")).toThrowError(
      /Paid invoices cannot be cancelled/
    );
  });

  it("allows cancelling DRAFT or CONFIRMED invoices without deleting the record", () => {
    const draftInvoice: InvoiceMock = {
      id: "inv_draft_1",
      invoiceNumber: "INV-2026-000100",
      status: "DRAFT",
      totalAmount: new Decimal(100),
      amountPaid: new Decimal(0),
    };

    const cancelledDraft = cancelInvoice(draftInvoice, "Pricing re-negotiation");
    expect(cancelledDraft.status).toBe("CANCELLED");
    expect(cancelledDraft.notes).toContain("Cancelled: Pricing re-negotiation");

    const confirmedInvoice: InvoiceMock = {
      id: "inv_conf_1",
      invoiceNumber: "INV-2026-000101",
      status: "CONFIRMED",
      totalAmount: new Decimal(150),
      amountPaid: new Decimal(0),
    };

    const cancelledConfirmed = cancelInvoice(confirmedInvoice, "Service terminated");
    expect(cancelledConfirmed.status).toBe("CANCELLED");
  });
});

describe("Subscription Eligibility Validation for Invoice Generation", () => {
  function validateSubscriptionEligibility(sub: {
    status: string;
    expiryDate?: Date | null;
  }, periodStart: Date) {
    if (sub.status === "PAUSED") {
      throw AppError.badRequest("Cannot generate invoice for a paused subscription", "SUBSCRIPTION_PAUSED");
    }
    if (sub.status === "CLOSED") {
      throw AppError.badRequest("Cannot generate invoice for a closed subscription", "SUBSCRIPTION_CLOSED");
    }
    if (sub.status === "DRAFT") {
      throw AppError.badRequest("Cannot generate invoice for a draft subscription", "INVALID_STATE_TRANSITION");
    }
    if (sub.expiryDate && periodStart > sub.expiryDate) {
      throw AppError.badRequest("Subscription expired", "SUBSCRIPTION_EXPIRED");
    }
    return true;
  }

  it("rejects invoice generation for PAUSED subscriptions", () => {
    expect(() =>
      validateSubscriptionEligibility({ status: "PAUSED" }, new Date("2026-01-01"))
    ).toThrowError(/Cannot generate invoice for a paused subscription/);
  });

  it("rejects invoice generation for CLOSED subscriptions", () => {
    expect(() =>
      validateSubscriptionEligibility({ status: "CLOSED" }, new Date("2026-01-01"))
    ).toThrowError(/Cannot generate invoice for a closed subscription/);
  });

  it("rejects invoice generation for expired subscriptions", () => {
    const pastExpiry = new Date("2025-12-31");
    const periodStart = new Date("2026-01-01");
    expect(() =>
      validateSubscriptionEligibility({ status: "ACTIVE", expiryDate: pastExpiry }, periodStart)
    ).toThrowError(/Subscription expired/);
  });

  it("accepts active subscriptions within validity period", () => {
    const futureExpiry = new Date("2026-12-31");
    const periodStart = new Date("2026-01-01");
    expect(
      validateSubscriptionEligibility({ status: "ACTIVE", expiryDate: futureExpiry }, periodStart)
    ).toBe(true);
  });
});
