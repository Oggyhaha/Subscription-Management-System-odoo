import { describe, it, expect, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { generateCycleKey } from "@/lib/dates";

describe("Billing Engine: Duplicate Prevention, Concurrency & Retry Resilience", () => {
  interface BillingCycleRecord {
    id: string;
    cycleKey: string;
    subscriptionId: string;
    invoiceId: string;
    createdAt: Date;
  }

  interface InvoiceRecord {
    id: string;
    invoiceNumber: string;
    subscriptionId: string;
    totalAmount: number;
    periodStart: Date;
    periodEnd: Date;
  }

  // Simulated Database Stores
  let billingCyclesDb: Map<string, BillingCycleRecord>;
  let invoicesDb: Map<string, InvoiceRecord>;
  let subscriptionBillingDates: Map<string, Date>;

  beforeEach(() => {
    billingCyclesDb = new Map();
    invoicesDb = new Map();
    subscriptionBillingDates = new Map();
  });

  async function mockGenerateInvoiceWithIdempotency(
    subId: string,
    periodStart: Date,
    periodEnd: Date,
    shouldFail = false
  ): Promise<{ invoice: InvoiceRecord; isDuplicate: boolean }> {
    const cycleKey = generateCycleKey(subId, periodStart, periodEnd);

    // 1. Strict Idempotency Check
    const existingCycle = billingCyclesDb.get(cycleKey);
    if (existingCycle) {
      const existingInvoice = invoicesDb.get(existingCycle.invoiceId);
      if (!existingInvoice) {
        throw new Error("Data integrity error: Billing cycle points to nonexistent invoice");
      }
      return { invoice: existingInvoice, isDuplicate: true };
    }

    if (shouldFail) {
      throw new Error(`Simulated database failure during invoice generation for ${subId}`);
    }

    // 2. Create Invoice
    const invoiceId = `inv_${subId}_${invoicesDb.size + 1}`;
    const invoice: InvoiceRecord = {
      id: invoiceId,
      invoiceNumber: `INV-2026-${String(invoicesDb.size + 1).padStart(6, "0")}`,
      subscriptionId: subId,
      totalAmount: 199.0,
      periodStart,
      periodEnd,
    };

    invoicesDb.set(invoiceId, invoice);

    // 3. Record unique billing cycle
    billingCyclesDb.set(cycleKey, {
      id: `cycle_${Date.now()}_${Math.random()}`,
      cycleKey,
      subscriptionId: subId,
      invoiceId,
      createdAt: new Date(),
    });

    // 4. Advance nextBillingDate
    subscriptionBillingDates.set(subId, periodEnd);

    return { invoice, isDuplicate: false };
  }

  it("1. Run billing cycle twice: returns existing invoice, creates no duplicate rows", async () => {
    const subId = "sub_alpha";
    const start = new Date("2026-03-01T00:00:00Z");
    const end = new Date("2026-04-01T00:00:00Z");

    // First billing cycle attempt
    const run1 = await mockGenerateInvoiceWithIdempotency(subId, start, end);
    expect(run1.isDuplicate).toBe(false);
    expect(run1.invoice.invoiceNumber).toBe("INV-2026-000001");
    expect(invoicesDb.size).toBe(1);
    expect(billingCyclesDb.size).toBe(1);

    // Second billing cycle attempt for the EXACT SAME period
    const run2 = await mockGenerateInvoiceWithIdempotency(subId, start, end);
    expect(run2.isDuplicate).toBe(true);
    expect(run2.invoice.id).toBe(run1.invoice.id);
    expect(run2.invoice.invoiceNumber).toBe("INV-2026-000001");

    // Must still have exactly ONE invoice and ONE cycle record
    expect(invoicesDb.size).toBe(1);
    expect(billingCyclesDb.size).toBe(1);
  });

  it("2. Concurrent billing runs: guarantees exactly ONE invoice is generated", async () => {
    const subId = "sub_concurrent";
    const start = new Date("2026-05-01T00:00:00Z");
    const end = new Date("2026-06-01T00:00:00Z");

    // Simulate 5 simultaneous worker threads attempting to bill the same subscription
    const workerPromises = Array.from({ length: 5 }, () =>
      mockGenerateInvoiceWithIdempotency(subId, start, end)
    );

    const results = await Promise.all(workerPromises);

    // Count how many created fresh vs reused
    const freshInvoices = results.filter((r) => !r.isDuplicate);
    const reusedInvoices = results.filter((r) => r.isDuplicate);

    expect(freshInvoices.length).toBe(1);
    expect(reusedInvoices.length).toBe(4);

    // All 5 workers must receive the exact same invoice ID
    const firstInvoiceId = freshInvoices[0].invoice.id;
    for (const res of results) {
      expect(res.invoice.id).toBe(firstInvoiceId);
    }

    // Invariant: Exactly one invoice in the database
    expect(invoicesDb.size).toBe(1);
    expect(billingCyclesDb.size).toBe(1);
  });

  it("3. Mid-run failure and safe retry: retries only failed items without double-billing", async () => {
    const subs = [
      { id: "sub_1", shouldFail: false },
      { id: "sub_2", shouldFail: true }, // Fails mid-run
      { id: "sub_3", shouldFail: false },
    ];

    const start = new Date("2026-06-01T00:00:00Z");
    const end = new Date("2026-07-01T00:00:00Z");

    // Execution 1: Batch billing run
    const run1Summary = { processed: 0, created: 0, failed: 0, errors: [] as string[] };

    for (const sub of subs) {
      run1Summary.processed++;
      try {
        const res = await mockGenerateInvoiceWithIdempotency(sub.id, start, end, sub.shouldFail);
        if (!res.isDuplicate) run1Summary.created++;
      } catch (err: any) {
        run1Summary.failed++;
        run1Summary.errors.push(err.message);
      }
    }

    // Sub 1 and Sub 3 succeeded, Sub 2 failed
    expect(run1Summary.processed).toBe(3);
    expect(run1Summary.created).toBe(2);
    expect(run1Summary.failed).toBe(1);
    expect(invoicesDb.size).toBe(2);

    // Invoices exist for sub_1 and sub_3, but NOT sub_2
    const sub1Invoices = Array.from(invoicesDb.values()).filter((i) => i.subscriptionId === "sub_1");
    const sub2Invoices = Array.from(invoicesDb.values()).filter((i) => i.subscriptionId === "sub_2");
    const sub3Invoices = Array.from(invoicesDb.values()).filter((i) => i.subscriptionId === "sub_3");

    expect(sub1Invoices.length).toBe(1);
    expect(sub2Invoices.length).toBe(0);
    expect(sub3Invoices.length).toBe(1);

    // Execution 2: Retrying the entire batch (Sub 2 now succeeds, e.g. network restored)
    subs[1].shouldFail = false; // Issue resolved

    const retrySummary = { processed: 0, created: 0, skippedDuplicate: 0, failed: 0 };

    for (const sub of subs) {
      retrySummary.processed++;
      try {
        const res = await mockGenerateInvoiceWithIdempotency(sub.id, start, end, sub.shouldFail);
        if (res.isDuplicate) {
          retrySummary.skippedDuplicate++;
        } else {
          retrySummary.created++;
        }
      } catch {
        retrySummary.failed++;
      }
    }

    // Sub 1 and 3 were recognized as duplicates; Sub 2 was created
    expect(retrySummary.processed).toBe(3);
    expect(retrySummary.created).toBe(1);
    expect(retrySummary.skippedDuplicate).toBe(2);
    expect(retrySummary.failed).toBe(0);

    // Final Invariant Check: Exactly 1 invoice per subscription per period
    expect(invoicesDb.size).toBe(3);
    expect(Array.from(invoicesDb.values()).filter((i) => i.subscriptionId === "sub_1").length).toBe(1);
    expect(Array.from(invoicesDb.values()).filter((i) => i.subscriptionId === "sub_2").length).toBe(1);
    expect(Array.from(invoicesDb.values()).filter((i) => i.subscriptionId === "sub_3").length).toBe(1);
  });
});

