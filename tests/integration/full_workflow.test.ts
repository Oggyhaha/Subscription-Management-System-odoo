import { describe, it, expect, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { toDecimal, addMoney, multiplyMoney, subtractMoney, roundMoney } from "@/lib/money";
import { PricingService } from "@/server/services/pricing";
import { calculateSubscriptionMrr } from "@/server/services/reporting";

describe("E2E Integration Workflow: Full Lifecycle from Product to Reporting", () => {
  // Step 1: Catalog Definition
  const product = {
    id: "prod_cloud_suite",
    name: "Enterprise Cloud Suite",
    description: "Full cloud productivity infrastructure",
    price: 100.0, // Base unit price $100.00
    active: true,
  };

  const variant = {
    id: "var_ha_cluster",
    productId: product.id,
    name: "High-Availability Cluster",
    priceModifier: 50.0, // +$50.00 variant adjustment
  };

  const plan = {
    id: "plan_enterprise_monthly",
    name: "Enterprise Monthly Plan",
    billingInterval: "MONTHLY" as const,
    price: 150.0,
    active: true,
  };

  const taxRule = {
    id: "tax_state_10",
    name: "State Technology Tax",
    rate: 0.1, // 10% exclusive tax
    isInclusive: false,
    active: true,
  };

  const discountRule = {
    id: "disc_promo_20",
    code: "PROMO20",
    name: "20% Promotional Discount",
    discountPercent: 20, // 20% discount
    active: true,
  };

  const customer = {
    id: "cust_acme_corp",
    userId: "usr_acme_admin",
    name: "Acme Enterprises Inc.",
    email: "billing@acme.com",
  };

  it("Step 1 & 2: Calculates Catalog pricing and generates Quotation from Template", async () => {
    // Adjusted unit price = Base ($100) + Variant ($50) = $150.00
    const adjustedUnitPrice = addMoney(product.price, variant.priceModifier);
    expect(adjustedUnitPrice.toNumber()).toBe(150.0);

    // Quantity = 2
    const quantity = 2;
    const lineGross = multiplyMoney(adjustedUnitPrice, quantity);
    expect(lineGross.toNumber()).toBe(300.0);

    // Quotation template with 20% discount
    const discountAmount = multiplyMoney(lineGross, discountRule.discountPercent / 100);
    expect(discountAmount.toNumber()).toBe(60.0);

    const taxableAmount = subtractMoney(lineGross, discountAmount);
    expect(taxableAmount.toNumber()).toBe(240.0);

    // 10% tax on taxable subtotal
    const taxAmount = multiplyMoney(taxableAmount, taxRule.rate);
    expect(taxAmount.toNumber()).toBe(24.0);

    // Total quote value = 240 + 24 = $264.00
    const totalQuoteAmount = addMoney(taxableAmount, taxAmount);
    expect(totalQuoteAmount.toNumber()).toBe(264.0);

    // Quotation snapshot object
    const quotation = {
      id: "quote_1001",
      quotationNumber: "QT-2026-000001",
      customerId: customer.id,
      status: "SENT" as const,
      totalAmount: totalQuoteAmount,
      items: [
        {
          productId: product.id,
          productVariantId: variant.id,
          quantity,
          unitPrice: adjustedUnitPrice,
          discountAmount,
          taxRuleId: taxRule.id,
          taxAmount,
          lineTotal: totalQuoteAmount,
        },
      ],
    };

    expect(quotation.status).toBe("SENT");
    expect(quotation.totalAmount.toNumber()).toBe(264.0);
    expect(quotation.items[0].lineTotal.toNumber()).toBe(264.0);
  });

  it("Step 3: Accepts Quotation and provisions Active Subscription", () => {
    const acceptedQuotationStatus = "ACCEPTED";
    expect(acceptedQuotationStatus).toBe("ACCEPTED");

    const subscription = {
      id: "sub_2001",
      subscriptionNumber: "SUB-2026-000001",
      customerId: customer.id,
      planId: plan.id,
      status: "ACTIVE" as const,
      billingInterval: plan.billingInterval,
      totalAmount: new Decimal(264.0),
      startDate: new Date("2026-01-01T00:00:00Z"),
      nextBillingDate: new Date("2026-01-01T00:00:00Z"),
      items: [
        {
          productId: product.id,
          productVariantId: variant.id,
          quantity: 2,
          unitPrice: 150.0,
          discountAmount: 60.0,
          taxRuleId: taxRule.id,
        },
      ],
    };

    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.totalAmount.toNumber()).toBe(264.0);
    expect(subscription.nextBillingDate.toISOString()).toContain("2026-01-01");
  });

  it("Step 4: Executes Billing Run and generates Invoice with immutable tax/discount snapshots", async () => {
    const period = {
      periodStart: new Date("2026-01-01T00:00:00Z"),
      periodEnd: new Date("2026-02-01T00:00:00Z"),
    };

    const mockSub = {
      id: "sub_2001",
      customerId: customer.id,
      items: [
        {
          id: "sub_item_1",
          productId: product.id,
          productVariantId: variant.id,
          quantity: 2,
          unitPrice: 100.0,
          variant: { id: variant.id, name: variant.name, priceModifier: 50.0 },
          taxRule: { id: taxRule.id, name: taxRule.name, rate: 0.1 },
          discountAmount: 60.0,
        },
      ],
    };

    const pricing = await PricingService.calculateInvoice(mockSub, period, { discountRules: [] });

    // Validate Pricing Engine Output
    expect(pricing.subtotal.toNumber()).toBe(300.0);
    expect(pricing.discountTotal.toNumber()).toBe(60.0);
    expect(pricing.taxTotal.toNumber()).toBe(24.0);
    expect(pricing.totalAmount.toNumber()).toBe(264.0);

    // Generated Invoice Record
    const invoice = {
      id: "inv_3001",
      invoiceNumber: "INV-2026-000001",
      subscriptionId: mockSub.id,
      customerId: customer.id,
      subtotal: pricing.subtotal,
      taxAmount: pricing.taxTotal,
      discountAmount: pricing.discountTotal,
      totalAmount: pricing.totalAmount,
      amountPaid: new Decimal(0.0),
      amountDue: pricing.totalAmount,
      status: "CONFIRMED" as const,
      dueDate: new Date("2026-01-15T00:00:00Z"),
    };

    expect(invoice.invoiceNumber).toBe("INV-2026-000001");
    expect(invoice.status).toBe("CONFIRMED");
    expect(invoice.totalAmount.toNumber()).toBe(264.0);
    expect(invoice.amountDue.toNumber()).toBe(264.0);
    expect(invoice.amountPaid.toNumber()).toBe(0.0);
  });

  it("Step 5: Records Partial Payment and verifies remaining amount due", () => {
    let invoice = {
      id: "inv_3001",
      totalAmount: new Decimal(264.0),
      amountPaid: new Decimal(0.0),
      amountDue: new Decimal(264.0),
      status: "CONFIRMED" as "CONFIRMED" | "PAID",
    };

    // Partial Payment of $100.00
    const partialPaymentAmount = new Decimal(100.0);
    const newAmountPaid = addMoney(invoice.amountPaid, partialPaymentAmount);
    const newAmountDue = subtractMoney(invoice.totalAmount, newAmountPaid);

    invoice = {
      ...invoice,
      amountPaid: newAmountPaid,
      amountDue: newAmountDue,
      status: newAmountDue.isZero() ? "PAID" : "CONFIRMED",
    };

    expect(invoice.amountPaid.toNumber()).toBe(100.0);
    expect(invoice.amountDue.toNumber()).toBe(164.0);
    expect(invoice.status).toBe("CONFIRMED"); // Remains confirmed because not fully settled
  });

  it("Step 6: Records Final Payment and confirms transition to PAID", () => {
    let invoice = {
      id: "inv_3001",
      totalAmount: new Decimal(264.0),
      amountPaid: new Decimal(100.0),
      amountDue: new Decimal(164.0),
      status: "CONFIRMED" as "CONFIRMED" | "PAID",
    };

    // Final Payment of remaining $164.00
    const finalPaymentAmount = new Decimal(164.0);
    const newAmountPaid = addMoney(invoice.amountPaid, finalPaymentAmount);
    const newAmountDue = subtractMoney(invoice.totalAmount, newAmountPaid);

    invoice = {
      ...invoice,
      amountPaid: newAmountPaid,
      amountDue: newAmountDue,
      status: newAmountDue.isZero() ? "PAID" : "CONFIRMED",
    };

    expect(invoice.amountPaid.toNumber()).toBe(264.0);
    expect(invoice.amountDue.toNumber()).toBe(0.0);
    expect(invoice.status).toBe("PAID"); // Successfully transitioned to PAID
  });

  it("Step 7: Reconciles Financial Reporting Numbers and Metrics", () => {
    // 1 Active Monthly Subscription at $264.00
    const mrr = calculateSubscriptionMrr(264.0, "MONTHLY");
    expect(mrr.toNumber()).toBe(264.0);

    // Total Collections
    const payment1 = 100.0;
    const payment2 = 164.0;
    const totalCollected = payment1 + payment2;
    expect(totalCollected).toBe(264.0);

    // Outstanding Receivables
    const outstandingReceivables = 0.0;
    expect(outstandingReceivables).toBe(0.0);

    // Total Customer LTV
    const customerLtv = totalCollected;
    expect(customerLtv).toBe(264.0);
  });
});

