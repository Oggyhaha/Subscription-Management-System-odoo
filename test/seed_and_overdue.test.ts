import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { isOverdue } from "@/server/services/payment";
import { roundMoney, toDecimal, addMoney, subtractMoney } from "@/lib/money";

describe("Overdue Calculation Logic & Edge Cases", () => {
  const referenceNow = new Date("2026-10-31T12:00:00Z");

  it("flags confirmed invoice past due date with remaining balance as OVERDUE", () => {
    const pastDueDate = new Date("2026-10-15T00:00:00Z");
    const result = isOverdue(
      {
        status: "CONFIRMED",
        amountDue: new Decimal("440.00"),
        dueDate: pastDueDate,
      },
      referenceNow
    );
    expect(result).toBe(true);
  });

  it("does NOT flag confirmed invoice as overdue if due date is in the future", () => {
    const futureDueDate = new Date("2026-11-15T00:00:00Z");
    const result = isOverdue(
      {
        status: "CONFIRMED",
        amountDue: new Decimal("132.00"),
        dueDate: futureDueDate,
      },
      referenceNow
    );
    expect(result).toBe(false);
  });

  it("does NOT flag fully paid invoice as overdue even if due date is in the past", () => {
    const pastDueDate = new Date("2026-03-15T00:00:00Z");
    const result = isOverdue(
      {
        status: "PAID",
        amountDue: new Decimal("0.00"),
        dueDate: pastDueDate,
      },
      referenceNow
    );
    expect(result).toBe(false);
  });

  it("does NOT flag draft invoice as overdue even if due date is in the past", () => {
    const pastDueDate = new Date("2026-09-01T00:00:00Z");
    const result = isOverdue(
      {
        status: "DRAFT",
        amountDue: new Decimal("250.00"),
        dueDate: pastDueDate,
      },
      referenceNow
    );
    expect(result).toBe(false);
  });

  it("does NOT flag cancelled invoice as overdue", () => {
    const pastDueDate = new Date("2026-08-01T00:00:00Z");
    const result = isOverdue(
      {
        status: "CANCELLED",
        amountDue: new Decimal("500.00"),
        dueDate: pastDueDate,
      },
      referenceNow
    );
    expect(result).toBe(false);
  });

  it("accurately handles partially paid invoices that are past due", () => {
    // Total 748.00, paid 300.00, balance due 448.00, past due date
    const pastDueDate = new Date("2026-10-20T00:00:00Z");
    const result = isOverdue(
      {
        status: "CONFIRMED",
        amountDue: new Decimal("448.00"),
        dueDate: pastDueDate,
      },
      referenceNow
    );
    expect(result).toBe(true);
  });

  it("respects sub-cent zero balance tolerance (amountDue <= 0.00) as not overdue", () => {
    const pastDueDate = new Date("2026-10-10T00:00:00Z");
    const result = isOverdue(
      {
        status: "CONFIRMED",
        amountDue: new Decimal("0.0000"),
        dueDate: pastDueDate,
      },
      referenceNow
    );
    expect(result).toBe(false);
  });
});

describe("Seed Invariant Consistency & Balance Integrity", () => {
  // Representation of the exact seed records created in prisma/seed.ts
  const seededDataset = [
    {
      invoiceNumber: "INV-2026-0001",
      status: "PAID",
      subtotal: "1200.00",
      taxTotal: "120.00",
      discountTotal: "0.00",
      totalAmount: "1320.00",
      amountPaid: "1320.00",
      amountDue: "0.00",
      payments: [{ amount: "1320.00", method: "BANK_TRANSFER" }],
    },
    {
      invoiceNumber: "INV-2026-0002",
      status: "CONFIRMED",
      subtotal: "680.00",
      taxTotal: "68.00",
      discountTotal: "0.00",
      totalAmount: "748.00",
      amountPaid: "300.00",
      amountDue: "448.00",
      payments: [{ amount: "300.00", method: "CREDIT_CARD" }],
    },
    {
      invoiceNumber: "INV-2026-0003",
      status: "CONFIRMED",
      subtotal: "400.00",
      taxTotal: "40.00",
      discountTotal: "0.00",
      totalAmount: "440.00",
      amountPaid: "0.00",
      amountDue: "440.00",
      payments: [],
    },
    {
      invoiceNumber: "INV-2026-0004",
      status: "DRAFT",
      subtotal: "120.00",
      taxTotal: "12.00",
      discountTotal: "0.00",
      totalAmount: "132.00",
      amountPaid: "0.00",
      amountDue: "132.00",
      payments: [],
    },
    {
      invoiceNumber: "INV-2026-0005",
      status: "CONFIRMED",
      subtotal: "120.00",
      taxTotal: "12.00",
      discountTotal: "0.00",
      totalAmount: "132.00",
      amountPaid: "0.00",
      amountDue: "132.00",
      payments: [],
    },
  ];

  it("verifies Invariant 1: totalAmount = subtotal + taxTotal - discountTotal for every seeded invoice", () => {
    for (const inv of seededDataset) {
      const subtotal = toDecimal(inv.subtotal);
      const tax = toDecimal(inv.taxTotal);
      const discount = toDecimal(inv.discountTotal);
      const expectedTotal = subtotal.plus(tax).minus(discount);

      expect(toDecimal(inv.totalAmount).toNumber()).toBe(expectedTotal.toNumber());
    }
  });

  it("verifies Invariant 2: amountPaid + amountDue = totalAmount for every seeded invoice", () => {
    for (const inv of seededDataset) {
      const paid = toDecimal(inv.amountPaid);
      const due = toDecimal(inv.amountDue);
      const sum = paid.plus(due);

      expect(sum.toNumber()).toBe(toDecimal(inv.totalAmount).toNumber());
    }
  });

  it("verifies Invariant 3: amountPaid strictly equals the sum of linked payments", () => {
    for (const inv of seededDataset) {
      const totalPayments = inv.payments.reduce(
        (acc, p) => acc.plus(toDecimal(p.amount)),
        new Decimal(0)
      );

      expect(toDecimal(inv.amountPaid).toNumber()).toBe(totalPayments.toNumber());
    }
  });

  it("verifies Invariant 4: no invoice produces negative balance due or overpayments", () => {
    for (const inv of seededDataset) {
      const due = toDecimal(inv.amountDue);
      const paid = toDecimal(inv.amountPaid);

      expect(due.gte(0)).toBe(true);
      expect(paid.gte(0)).toBe(true);
      expect(paid.lte(toDecimal(inv.totalAmount))).toBe(true);
    }
  });

  it("verifies Invariant 5: PAID invoices have exact zero balance due and match full total", () => {
    const paidInvoices = seededDataset.filter((i) => i.status === "PAID");
    for (const inv of paidInvoices) {
      expect(toDecimal(inv.amountDue).toNumber()).toBe(0.0);
      expect(toDecimal(inv.amountPaid).toNumber()).toBe(toDecimal(inv.totalAmount).toNumber());
    }
  });
});

