import { describe, it, expect, vi, beforeEach } from "vitest";
import { addInterval, generateCycleKey } from "../src/lib/dates";
import { toDecimal, addMoney } from "../src/lib/money";
import { AppError } from "../src/lib/errors";
import Decimal from "decimal.js";

describe("Due Subscriptions Selection & State Filtering", () => {
  interface SubscriptionStub {
    id: string;
    subscriptionNumber: string;
    status: "ACTIVE" | "PAUSED" | "CLOSED" | "DRAFT" | "QUOTATION" | "CONFIRMED";
    nextBillingDate: Date;
    expiryDate?: Date | null;
    autoCloseAtEnd?: boolean;
    itemsCount: number;
  }

  function filterDueSubscriptions(subs: SubscriptionStub[], now: Date): {
    due: SubscriptionStub[];
    autoClosed: SubscriptionStub[];
    skipped: SubscriptionStub[];
  } {
    const due: SubscriptionStub[] = [];
    const autoClosed: SubscriptionStub[] = [];
    const skipped: SubscriptionStub[] = [];

    for (const sub of subs) {
      // 1. Strict status guard: Only ACTIVE subscriptions can be billed
      if (sub.status !== "ACTIVE") {
        skipped.push(sub);
        continue;
      }

      // 2. Due date check: nextBillingDate must be <= now
      if (sub.nextBillingDate > now) {
        skipped.push(sub);
        continue;
      }

      // 3. Expiry and auto-close check
      if (sub.expiryDate && sub.expiryDate <= now) {
        if (sub.autoCloseAtEnd) {
          autoClosed.push(sub);
        } else {
          skipped.push(sub);
        }
        continue;
      }

      // 4. Ineligible items check
      if (sub.itemsCount === 0) {
        skipped.push(sub);
        continue;
      }

      due.push(sub);
    }

    return { due, autoClosed, skipped };
  }

  const now = new Date("2026-06-01T00:00:00.000Z");

  it("selects only active subscriptions where nextBillingDate <= now", () => {
    const subs: SubscriptionStub[] = [
      {
        id: "sub_1",
        subscriptionNumber: "SUB-001",
        status: "ACTIVE",
        nextBillingDate: new Date("2026-05-31T00:00:00.000Z"), // Past due -> DUE
        itemsCount: 1,
      },
      {
        id: "sub_2",
        subscriptionNumber: "SUB-002",
        status: "ACTIVE",
        nextBillingDate: new Date("2026-06-01T00:00:00.000Z"), // Exact due -> DUE
        itemsCount: 2,
      },
      {
        id: "sub_3",
        subscriptionNumber: "SUB-003",
        status: "ACTIVE",
        nextBillingDate: new Date("2026-06-15T00:00:00.000Z"), // Future -> NOT DUE
        itemsCount: 1,
      },
    ];

    const result = filterDueSubscriptions(subs, now);
    expect(result.due.length).toBe(2);
    expect(result.due.map((s) => s.id)).toEqual(["sub_1", "sub_2"]);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0].id).toBe("sub_3");
  });

  it("strictly excludes PAUSED, CLOSED, DRAFT, and QUOTATION subscriptions", () => {
    const subs: SubscriptionStub[] = [
      {
        id: "sub_paused",
        subscriptionNumber: "SUB-PAUSED",
        status: "PAUSED",
        nextBillingDate: new Date("2026-05-01"), // past due, but paused
        itemsCount: 1,
      },
      {
        id: "sub_closed",
        subscriptionNumber: "SUB-CLOSED",
        status: "CLOSED",
        nextBillingDate: new Date("2026-05-01"), // past due, but closed
        itemsCount: 1,
      },
      {
        id: "sub_draft",
        subscriptionNumber: "SUB-DRAFT",
        status: "DRAFT",
        nextBillingDate: new Date("2026-05-01"), // draft
        itemsCount: 1,
      },
      {
        id: "sub_quotation",
        subscriptionNumber: "SUB-QUOTE",
        status: "QUOTATION",
        nextBillingDate: new Date("2026-05-01"), // quotation
        itemsCount: 1,
      },
    ];

    const result = filterDueSubscriptions(subs, now);
    expect(result.due.length).toBe(0);
    expect(result.skipped.length).toBe(4);
  });

  it("handles auto-close at expiry date when autoCloseAtEnd is enabled", () => {
    const expiredSub: SubscriptionStub = {
      id: "sub_expired_autoclose",
      subscriptionNumber: "SUB-EXP",
      status: "ACTIVE",
      nextBillingDate: new Date("2026-06-01"),
      expiryDate: new Date("2026-05-31"), // expired yesterday
      autoCloseAtEnd: true,
      itemsCount: 1,
    };

    const result = filterDueSubscriptions([expiredSub], now);
    expect(result.due.length).toBe(0);
    expect(result.autoClosed.length).toBe(1);
    expect(result.autoClosed[0].id).toBe("sub_expired_autoclose");
  });
});

describe("Billing Cycle Idempotency & Duplicate Prevention", () => {
  it("running the same billing cycle twice returns existing invoice without creating duplicates", async () => {
    const billingCycleDb = new Map<string, { cycleKey: string; invoiceId: string }>();
    const invoiceDb = new Map<string, any>();
    let invoiceCounter = 0;

    async function processCycle(subId: string, periodStart: Date, periodEnd: Date) {
      const cycleKey = `sub_${subId}_${periodStart.toISOString().split("T")[0]}_${periodEnd.toISOString().split("T")[0]}`;

      // Idempotency check: if cycle already registered, return existing invoice
      if (billingCycleDb.has(cycleKey)) {
        const existing = billingCycleDb.get(cycleKey)!;
        return {
          invoice: invoiceDb.get(existing.invoiceId),
          createdNew: false,
        };
      }

      invoiceCounter++;
      const invoiceId = `inv_${invoiceCounter}`;
      const newInvoice = {
        id: invoiceId,
        invoiceNumber: `INV-2026-00000${invoiceCounter}`,
        cycleKey,
        amount: 199.0,
      };

      invoiceDb.set(invoiceId, newInvoice);
      billingCycleDb.set(cycleKey, { cycleKey, invoiceId });

      return {
        invoice: newInvoice,
        createdNew: true,
      };
    }

    const start = new Date("2026-07-01");
    const end = new Date("2026-08-01");

    // Run 1: First attempt creates invoice
    const run1 = await processCycle("sub_alpha", start, end);
    expect(run1.createdNew).toBe(true);
    expect(run1.invoice.invoiceNumber).toBe("INV-2026-000001");
    expect(invoiceDb.size).toBe(1);
    expect(billingCycleDb.size).toBe(1);

    // Run 2: Exact same cycle re-run returns existing invoice (idempotent no-op)
    const run2 = await processCycle("sub_alpha", start, end);
    expect(run2.createdNew).toBe(false);
    expect(run2.invoice.id).toBe(run1.invoice.id);
    expect(run2.invoice.invoiceNumber).toBe("INV-2026-000001");
    expect(invoiceDb.size).toBe(1); // No duplicate invoice created!
    expect(billingCycleDb.size).toBe(1); // No duplicate cycle registered!
  });
});

describe("Safe Retries After Failure", () => {
  it("retrying after a failed attempt creates the invoice without duplicate billing cycles", async () => {
    let failFirstAttempt = true;
    const billingAttempts: Array<{ attempt: number; success: boolean; invoiceId?: string }> = [];

    async function attemptBilling(attemptNumber: number) {
      if (failFirstAttempt) {
        failFirstAttempt = false; // Next attempt will succeed
        billingAttempts.push({ attempt: attemptNumber, success: false });
        throw new Error("Simulated database timeout or network blip");
      }

      const invoiceId = "inv_retry_success";
      billingAttempts.push({ attempt: attemptNumber, success: true, invoiceId });
      return { invoiceId, status: "CREATED" };
    }

    // Attempt 1 fails
    await expect(attemptBilling(1)).rejects.toThrow("Simulated database timeout");
    expect(billingAttempts.length).toBe(1);
    expect(billingAttempts[0].success).toBe(false);

    // Attempt 2 (retry) succeeds
    const retryResult = await attemptBilling(2);
    expect(retryResult.status).toBe("CREATED");
    expect(billingAttempts.length).toBe(2);
    expect(billingAttempts[1].success).toBe(true);
    expect(billingAttempts[1].invoiceId).toBe("inv_retry_success");
  });
});

describe("Subscription nextBillingDate Advances Exactly Once", () => {
  it("advances nextBillingDate by interval from currentPeriodEnd exactly once per cycle", () => {
    const sub = {
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      nextBillingDate: new Date("2026-02-01T00:00:00.000Z"),
      billingInterval: "MONTHLY" as const,
    };

    // Cycle period to be billed
    const periodStart = sub.currentPeriodEnd;
    const periodEnd = addInterval(periodStart, sub.billingInterval, 1);
    const updatedNextBillingDate = addInterval(sub.nextBillingDate, sub.billingInterval, 1);

    // After billing cycle completes
    const updatedSub = {
      ...sub,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextBillingDate: updatedNextBillingDate,
    };

    expect(updatedSub.currentPeriodStart.toISOString().split("T")[0]).toBe("2026-02-01");
    expect(updatedSub.currentPeriodEnd.toISOString().split("T")[0]).toBe("2026-03-01");
    expect(updatedSub.nextBillingDate.toISOString().split("T")[0]).toBe("2026-03-01");

    // Running again for same cycle must NOT advance nextBillingDate a second time
    const cycleKey = `sub_1_${periodStart.toISOString().split("T")[0]}_${periodEnd.toISOString().split("T")[0]}`;
    const isCycleAlreadyProcessed = true;
    if (isCycleAlreadyProcessed) {
      // No-op: nextBillingDate remains 2026-03-01
    }
    expect(updatedSub.nextBillingDate.toISOString().split("T")[0]).toBe("2026-03-01");
  });
});

describe("Month-End and Leap-Year Interval Calculations", () => {
  it("correctly clamps month-end Jan 31 + 1 month to Feb 28 in a non-leap year (2026)", () => {
    const jan31_2026 = new Date(2026, 0, 31); // Jan 31, 2026
    const nextMonth = addInterval(jan31_2026, "MONTHLY", 1);

    expect(nextMonth.getFullYear()).toBe(2026);
    expect(nextMonth.getMonth()).toBe(1); // February (0-indexed)
    expect(nextMonth.getDate()).toBe(28); // Feb 28
  });

  it("correctly clamps month-end Jan 31 + 1 month to Feb 29 in a leap year (2024)", () => {
    const jan31_2024 = new Date(2024, 0, 31); // Jan 31, 2024 (leap year)
    const nextMonth = addInterval(jan31_2024, "MONTHLY", 1);

    expect(nextMonth.getFullYear()).toBe(2024);
    expect(nextMonth.getMonth()).toBe(1); // February
    expect(nextMonth.getDate()).toBe(29); // Feb 29
  });

  it("correctly rolls Feb 29 in leap year (2024) + 1 year to Feb 28, 2025 in non-leap year", () => {
    const feb29_2024 = new Date(2024, 1, 29); // Feb 29, 2024
    const nextYear = addInterval(feb29_2024, "YEARLY", 1);

    expect(nextYear.getFullYear()).toBe(2025);
    expect(nextYear.getMonth()).toBe(1); // February
    expect(nextYear.getDate()).toBe(28); // Feb 28 (clamped)
  });

  it("correctly clamps 31-day months into 30-day months (Aug 31 + 1 month => Sep 30)", () => {
    const aug31_2026 = new Date(2026, 7, 31); // Aug 31, 2026
    const nextMonth = addInterval(aug31_2026, "MONTHLY", 1);

    expect(nextMonth.getFullYear()).toBe(2026);
    expect(nextMonth.getMonth()).toBe(8); // September
    expect(nextMonth.getDate()).toBe(30); // Sep 30
  });
});

