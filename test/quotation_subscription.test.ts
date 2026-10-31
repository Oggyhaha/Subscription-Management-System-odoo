import { describe, it, expect, vi, beforeEach } from "vitest";
import { addInterval } from "../src/lib/dates";
import { toDecimal, addMoney, multiplyMoney, formatMoney } from "../src/lib/money";
import Decimal from "decimal.js";

describe("Subscription State Machine Validation", () => {
  type SubscriptionStatus = "DRAFT" | "QUOTATION" | "CONFIRMED" | "ACTIVE" | "PAUSED" | "CLOSED";

  interface SubscriptionMock {
    status: SubscriptionStatus;
    allowPause: boolean;
    allowRenewal: boolean;
    allowEarlyClose: boolean;
    currentPeriodEnd: Date;
    billingInterval: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  }

  function transition(sub: SubscriptionMock, action: string): SubscriptionMock {
    const currentState = sub.status;
    let targetState: SubscriptionStatus;
    let newPeriodEnd = sub.currentPeriodEnd;

    switch (action) {
      case "CONFIRM":
        if (currentState !== "DRAFT" && currentState !== "QUOTATION") {
          throw new Error(`Invalid state transition from ${currentState} to CONFIRMED`);
        }
        targetState = "CONFIRMED";
        break;

      case "ACTIVATE":
        if (currentState !== "CONFIRMED" && currentState !== "PAUSED") {
          throw new Error(`Invalid state transition from ${currentState} to ACTIVE`);
        }
        targetState = "ACTIVE";
        break;

      case "PAUSE":
        if (currentState !== "ACTIVE") {
          throw new Error(`Invalid state transition from ${currentState} to PAUSED`);
        }
        if (!sub.allowPause) {
          throw new Error("This subscription plan does not allow pausing.");
        }
        targetState = "PAUSED";
        break;

      case "RESUME":
        if (currentState !== "PAUSED") {
          throw new Error(`Invalid state transition from ${currentState} to ACTIVE`);
        }
        targetState = "ACTIVE";
        break;

      case "RENEW":
        if (currentState !== "ACTIVE") {
          throw new Error(`Invalid state transition from ${currentState} to ACTIVE (Renewal)`);
        }
        if (!sub.allowRenewal) {
          throw new Error("This subscription plan does not allow renewal.");
        }
        targetState = "ACTIVE";
        newPeriodEnd = addInterval(sub.currentPeriodEnd, sub.billingInterval, 1);
        break;

      case "CLOSE":
        if (currentState === "CLOSED") {
          throw new Error("Subscription is already closed.");
        }
        targetState = "CLOSED";
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return {
      ...sub,
      status: targetState,
      currentPeriodEnd: newPeriodEnd,
    };
  }

  it("advances Draft -> Confirmed -> Active -> Closed smoothly", () => {
    let sub: SubscriptionMock = {
      status: "DRAFT",
      allowPause: true,
      allowRenewal: true,
      allowEarlyClose: true,
      currentPeriodEnd: new Date(2026, 0, 1),
      billingInterval: "MONTHLY",
    };

    sub = transition(sub, "CONFIRM");
    expect(sub.status).toBe("CONFIRMED");

    sub = transition(sub, "ACTIVATE");
    expect(sub.status).toBe("ACTIVE");

    sub = transition(sub, "CLOSE");
    expect(sub.status).toBe("CLOSED");
  });

  it("handles Pause and Resume when allowed by plan", () => {
    let sub: SubscriptionMock = {
      status: "ACTIVE",
      allowPause: true,
      allowRenewal: true,
      allowEarlyClose: true,
      currentPeriodEnd: new Date(2026, 0, 1),
      billingInterval: "MONTHLY",
    };

    sub = transition(sub, "PAUSE");
    expect(sub.status).toBe("PAUSED");

    sub = transition(sub, "RESUME");
    expect(sub.status).toBe("ACTIVE");
  });

  it("strictly forbids pausing if plan disallows it", () => {
    const sub: SubscriptionMock = {
      status: "ACTIVE",
      allowPause: false, // Disallowed
      allowRenewal: true,
      allowEarlyClose: true,
      currentPeriodEnd: new Date(2026, 0, 1),
      billingInterval: "MONTHLY",
    };

    expect(() => transition(sub, "PAUSE")).toThrow("does not allow pausing");
  });

  it("forbids any transition out of CLOSED (terminal state)", () => {
    const sub: SubscriptionMock = {
      status: "CLOSED",
      allowPause: true,
      allowRenewal: true,
      allowEarlyClose: true,
      currentPeriodEnd: new Date(2026, 0, 1),
      billingInterval: "MONTHLY",
    };

    expect(() => transition(sub, "ACTIVATE")).toThrow("Invalid state transition");
    expect(() => transition(sub, "CONFIRM")).toThrow("Invalid state transition");
    expect(() => transition(sub, "RESUME")).toThrow("Invalid state transition");
    expect(() => transition(sub, "CLOSE")).toThrow("already closed");
  });

  it("calculates renewal date accurately using addInterval", () => {
    const startEnd = new Date(2026, 0, 31); // Jan 31, 2026
    let sub: SubscriptionMock = {
      status: "ACTIVE",
      allowPause: true,
      allowRenewal: true,
      allowEarlyClose: true,
      currentPeriodEnd: startEnd,
      billingInterval: "MONTHLY",
    };

    sub = transition(sub, "RENEW");
    expect(sub.status).toBe("ACTIVE");
    // Jan 31 + 1 month in 2026 (non-leap) clamps to Feb 28
    expect(sub.currentPeriodEnd.getMonth()).toBe(1); // February
    expect(sub.currentPeriodEnd.getDate()).toBe(28);
  });
});

describe("Quotation -> Subscription Conversion & Idempotency", () => {
  it("converts quotation lines and totals into subscription items without drift", () => {
    const quoteItems = [
      { productId: "p1", quantity: 5, unitPrice: 100.0, taxAmount: 50.0, lineTotal: 550.0 },
      { productId: "p2", quantity: 2, unitPrice: 250.0, taxAmount: 50.0, lineTotal: 550.0 },
    ];

    const subtotal = quoteItems.reduce((sum, item) => addMoney(sum, multiplyMoney(item.unitPrice, item.quantity)), new Decimal(0));
    const taxTotal = quoteItems.reduce((sum, item) => addMoney(sum, item.taxAmount), new Decimal(0));
    const totalAmount = addMoney(subtotal, taxTotal);

    expect(subtotal.toString()).toBe("1000");
    expect(taxTotal.toString()).toBe("100");
    expect(totalAmount.toString()).toBe("1100");
    expect(formatMoney(totalAmount)).toContain("1,100.00");
    expect(formatMoney(totalAmount)).toContain("₹");
  });

  it("prevents double-conversion idempotently", () => {
    const quote = {
      id: "quote_123",
      quotationNumber: "QT-2026-000001",
      status: "CONFIRMED" as const,
      subscription: { id: "sub_123", subscriptionNumber: "SUB-2026-000001" },
    };

    function accept(q: typeof quote) {
      if (q.status === "CONFIRMED" && q.subscription) {
        return {
          alreadyAccepted: true,
          subscription: q.subscription,
        };
      }
      return { alreadyAccepted: false, subscription: { id: "new_sub" } };
    }

    const first = accept(quote);
    expect(first.alreadyAccepted).toBe(true);
    expect(first.subscription.id).toBe("sub_123");
  });
});

