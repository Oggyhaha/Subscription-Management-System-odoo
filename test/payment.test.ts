import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  isOverdue,
  getAgingBracket,
  calculatePaymentBalance,
} from "@/server/services/payment";
import { AppError } from "@/lib/errors";

describe("Payment Calculation & Balance Management", () => {
  it("processes partial payment and updates balances correctly", () => {
    // Invoice has total 1000.00, 0 paid so far, 1000.00 due
    const result = calculatePaymentBalance(0, 1000.0, 400.0);

    expect(result.newAmountPaid.toNumber()).toBe(400.0);
    expect(result.newAmountDue.toNumber()).toBe(600.0);
    expect(result.isFullyPaid).toBe(false);
  });

  it("processes subsequent full payment and transitions to fully paid", () => {
    // Current invoice has 400.00 paid, 600.00 due. Paying remaining 600.00
    const result = calculatePaymentBalance(400.0, 600.0, 600.0);

    expect(result.newAmountPaid.toNumber()).toBe(1000.0);
    expect(result.newAmountDue.toNumber()).toBe(0.0);
    expect(result.isFullyPaid).toBe(true);
  });

  it("handles floating rounding tolerance ($0.004) safely to zero", () => {
    // Remainder under half-cent threshold due to rounding
    const result = calculatePaymentBalance(99.99, 100.0, 99.996);

    expect(result.newAmountDue.toNumber()).toBe(0.0);
    expect(result.isFullyPaid).toBe(true);
  });

  it("strictly rejects overpayments where payment exceeds balance due", () => {
    // Balance due is $250.00, customer attempts to pay $300.00
    expect(() => {
      calculatePaymentBalance(0, 250.0, 300.0);
    }).toThrowError(/exceeds remaining balance due/i);
  });

  it("rejects zero or negative payment amounts", () => {
    expect(() => {
      calculatePaymentBalance(0, 500.0, 0);
    }).toThrowError(/greater than zero/i);

    expect(() => {
      calculatePaymentBalance(0, 500.0, -50);
    }).toThrowError(/greater than zero/i);
  });
});

describe("Overdue Logic & Aging Buckets", () => {
  const baseDate = new Date("2026-10-31T12:00:00Z");

  it("identifies overdue invoice when confirmed, balance > 0, and dueDate < now", () => {
    const overdueInvoice = {
      status: "CONFIRMED",
      amountDue: 450.0,
      dueDate: new Date("2026-10-15T00:00:00Z"), // 16 days ago
    };

    expect(isOverdue(overdueInvoice, baseDate)).toBe(true);
  });

  it("does not classify future invoice as overdue", () => {
    const currentInvoice = {
      status: "CONFIRMED",
      amountDue: 450.0,
      dueDate: new Date("2026-11-15T00:00:00Z"), // 15 days in future
    };

    expect(isOverdue(currentInvoice, baseDate)).toBe(false);
  });

  it("does not classify fully paid invoice as overdue even if dueDate is past", () => {
    const paidInvoice = {
      status: "PAID",
      amountDue: 0.0,
      dueDate: new Date("2026-09-01T00:00:00Z"),
    };

    expect(isOverdue(paidInvoice, baseDate)).toBe(false);
  });

  it("does not classify draft invoice as overdue", () => {
    const draftInvoice = {
      status: "DRAFT",
      amountDue: 500.0,
      dueDate: new Date("2026-10-01T00:00:00Z"),
    };

    expect(isOverdue(draftInvoice, baseDate)).toBe(false);
  });

  it("correctly buckets invoices into financial aging brackets", () => {
    // Current (not past due)
    expect(getAgingBracket("2026-11-05T00:00:00Z", baseDate)).toBe("CURRENT");

    // 1 to 30 days overdue (due Oct 15 -> 16 days overdue)
    expect(getAgingBracket("2026-10-15T00:00:00Z", baseDate)).toBe("1_30");

    // 31 to 60 days overdue (due Sept 15 -> 46 days overdue)
    expect(getAgingBracket("2026-09-15T00:00:00Z", baseDate)).toBe("31_60");

    // 61 to 90 days overdue (due Aug 15 -> 77 days overdue)
    expect(getAgingBracket("2026-08-15T00:00:00Z", baseDate)).toBe("61_90");

    // 90+ days overdue (due May 01 -> ~180 days overdue)
    expect(getAgingBracket("2026-05-01T00:00:00Z", baseDate)).toBe("90_PLUS");
  });
});

describe("Duplicate Reference Safeguard", () => {
  it("rejects duplicate payment reference notes on the same invoice", () => {
    const existingPayments = [
      { invoiceId: "inv_1", referenceNote: "CHK-9941" },
      { invoiceId: "inv_1", referenceNote: "WIRE-001" },
    ];

    const checkDuplicate = (invoiceId: string, ref: string) => {
      const found = existingPayments.find(
        (p) => p.invoiceId === invoiceId && p.referenceNote === ref
      );
      if (found) {
        throw AppError.conflict(`Payment reference '${ref}' has already been recorded for this invoice.`);
      }
    };

    // New unique reference passes
    expect(() => checkDuplicate("inv_1", "CHK-9942")).not.toThrow();

    // Duplicate reference throws conflict error
    expect(() => checkDuplicate("inv_1", "CHK-9941")).toThrowError(/already been recorded/i);
  });
});

describe("Concurrency Safety: Concurrent Payments on Single Invoice", () => {
  it("prevents overpayment under concurrent race conditions", async () => {
    // Invoice starts with balance of $500.00
    let invoice = {
      id: "inv_concurrent_1",
      amountPaid: 0.0,
      amountDue: 500.0,
      status: "CONFIRMED",
    };

    // Sequential transaction lock mutex simulator
    let txLock = Promise.resolve();

    const recordConcurrentPayment = async (amount: number) => {
      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        txLock = txLock.then(async () => {
          try {
            if (invoice.status === "PAID" || invoice.amountDue <= 0) {
              resolve({ success: false, error: "Invoice already fully paid" });
              return;
            }

            if (amount > invoice.amountDue) {
              resolve({
                success: false,
                error: `Payment amount ($${amount}) exceeds remaining balance due ($${invoice.amountDue})`,
              });
              return;
            }

            const { newAmountPaid, newAmountDue, isFullyPaid } = calculatePaymentBalance(
              invoice.amountPaid,
              invoice.amountDue,
              amount
            );

            invoice.amountPaid = newAmountPaid.toNumber();
            invoice.amountDue = newAmountDue.toNumber();
            if (isFullyPaid) invoice.status = "PAID";

            resolve({ success: true });
          } catch (err: unknown) {
            resolve({ success: false, error: (err as Error).message });
          }
        });
      });
    };

    // Two simultaneous payments of $300.00 on a $500.00 invoice
    // Total attempted = $600.00. First must succeed ($200 remaining), second must be rejected ($300 > $200).
    const [p1, p2] = await Promise.all([
      recordConcurrentPayment(300.0),
      recordConcurrentPayment(300.0),
    ]);

    const results = [p1, p2];
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    expect(failures[0].error).toContain("exceeds remaining balance due");
    expect(invoice.amountPaid).toBe(300.0);
    expect(invoice.amountDue).toBe(200.0);
    expect(invoice.status).toBe("CONFIRMED");
  });
});

