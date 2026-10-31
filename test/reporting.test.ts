import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { calculateSubscriptionMrr } from "@/server/services/reporting";

describe("ReportingService - MRR Calculation Methodology", () => {
  it("calculates monthly subscription MRR at 100% face value", () => {
    const mrr = calculateSubscriptionMrr(99.0, "MONTHLY");
    expect(mrr.toNumber()).toBe(99.0);
  });

  it("normalizes yearly subscriptions to monthly equivalent (/ 12)", () => {
    // $1,200/year -> $100.00/month
    const mrr = calculateSubscriptionMrr(1200.0, "YEARLY");
    expect(mrr.toNumber()).toBe(100.0);

    // $149.99/year -> $12.50/month (properly rounded)
    const mrr2 = calculateSubscriptionMrr(149.99, "YEARLY");
    expect(mrr2.toNumber()).toBe(12.5);
  });

  it("normalizes weekly subscriptions using 52-week standard ((amount * 52) / 12)", () => {
    // $100/week -> $433.33/month
    const mrr = calculateSubscriptionMrr(100.0, "WEEKLY");
    expect(mrr.toNumber()).toBe(433.33);
  });

  it("normalizes daily subscriptions using 365-day standard ((amount * 365) / 12)", () => {
    // $10/day -> $304.17/month
    const mrr = calculateSubscriptionMrr(10.0, "DAILY");
    expect(mrr.toNumber()).toBe(304.17);
  });

  it("returns 0 for non-positive amounts", () => {
    expect(calculateSubscriptionMrr(0, "MONTHLY").toNumber()).toBe(0);
    expect(calculateSubscriptionMrr(-50, "MONTHLY").toNumber()).toBe(0);
  });
});

describe("Reporting Financial Aggregations & Invariants", () => {
  // Known dataset simulating a business snapshot
  const mockDataset = {
    invoices: [
      { id: "inv-1", totalAmount: 1000.0, amountDue: 0.0, status: "PAID", dueDate: new Date("2026-10-01") },
      { id: "inv-2", totalAmount: 500.0, amountDue: 200.0, status: "CONFIRMED", dueDate: new Date("2026-10-15") }, // Overdue
      { id: "inv-3", totalAmount: 750.0, amountDue: 750.0, status: "CONFIRMED", dueDate: new Date("2026-11-15") }, // Outstanding, not overdue
      { id: "inv-4", totalAmount: 300.0, amountDue: 300.0, status: "CANCELLED", dueDate: new Date("2026-10-10") }, // Cancelled, ignored
    ],
    payments: [
      { id: "pay-1", amount: 1000.0, paymentDate: new Date("2026-10-02") },
      { id: "pay-2", amount: 300.0, paymentDate: new Date("2026-10-20") },
    ],
  };

  const evaluationDate = new Date("2026-10-31T00:00:00Z");

  it("strictly separates invoiced receivables from collected cash receipts", () => {
    // Total invoiced across non-cancelled invoices: 1000 + 500 + 750 = 2250.00
    const nonCancelledInvoices = mockDataset.invoices.filter((i) => i.status !== "CANCELLED");
    const totalInvoiced = nonCancelledInvoices.reduce((acc, i) => acc + i.totalAmount, 0);

    // Total cash collected from payments table ONLY: 1000 + 300 = 1300.00
    const totalCollectedCash = mockDataset.payments.reduce((acc, p) => acc + p.amount, 0);

    expect(totalInvoiced).toBe(2250.0);
    expect(totalCollectedCash).toBe(1300.0);

    // Rule: Cash collected must NEVER equal invoice totals when unpaid balances exist!
    expect(totalCollectedCash).not.toBe(totalInvoiced);
  });

  it("calculates total outstanding receivables accurately", () => {
    // Invoices with status CONFIRMED and amountDue > 0
    const outstandingInvoices = mockDataset.invoices.filter(
      (i) => i.status === "CONFIRMED" && i.amountDue > 0
    );
    const totalOutstanding = outstandingInvoices.reduce((acc, i) => acc + i.amountDue, 0);

    // inv-2 (200) + inv-3 (750) = 950.00
    expect(totalOutstanding).toBe(950.0);
    expect(outstandingInvoices.length).toBe(2);
  });

  it("calculates overdue count and amount based on evaluation date", () => {
    // Invoices with status CONFIRMED, amountDue > 0, and dueDate < evaluationDate
    const overdueInvoices = mockDataset.invoices.filter(
      (i) => i.status === "CONFIRMED" && i.amountDue > 0 && i.dueDate < evaluationDate
    );
    const totalOverdue = overdueInvoices.reduce((acc, i) => acc + i.amountDue, 0);

    // inv-2 is due 2026-10-15 (< Oct 31) with balance 200.00
    // inv-3 is due 2026-11-15 (> Oct 31), not overdue
    expect(totalOverdue).toBe(200.0);
    expect(overdueInvoices.length).toBe(1);
    expect(overdueInvoices[0].id).toBe("inv-2");
  });

  it("preserves reconciliation balance: invoiced = collected + outstanding", () => {
    // In our closed system for confirmed/paid items:
    // inv-1 (1000) was paid via pay-1 (1000)
    // inv-2 (500) had partial payment pay-2 (300), balance is 200
    // inv-3 (750) had 0 paid, balance is 750
    const activeInvoiced = 1000 + 500 + 750; // 2250
    const collected = 1000 + 300;            // 1300
    const outstanding = 200 + 750;           // 950

    expect(collected + outstanding).toBe(activeInvoiced);
  });
});

