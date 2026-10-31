import { describe, it, expect } from "vitest";
import {
  toDecimal,
  roundMoney,
  addMoney,
  subtractMoney,
  multiplyMoney,
  calculatePercentage,
  formatMoney,
  divideMoney,
} from "../src/lib/money";
import { addInterval, generateCycleKey, isOverdue } from "../src/lib/dates";

describe("src/lib/money", () => {
  it("rounds using ROUND_HALF_UP correctly to 2 decimal places", () => {
    expect(roundMoney("10.005").toString()).toBe("10.01");
    expect(roundMoney("10.004").toString()).toBe("10");
    expect(roundMoney(10.555).toString()).toBe("10.56");
  });

  it("adds and subtracts without floating point errors", () => {
    // 0.1 + 0.2 in float is 0.30000000000000004
    expect(addMoney(0.1, 0.2).toString()).toBe("0.3");
    expect(subtractMoney(100, "25.50", "14.25").toString()).toBe("60.25");
  });

  it("calculates percentage accurately", () => {
    // 15% of $150 = $22.50
    expect(calculatePercentage(150, 15).toString()).toBe("22.5");
    // 8.25% of $99.99 = 8.249175 => 8.25
    expect(calculatePercentage("99.99", "8.25").toString()).toBe("8.25");
  });

  it("formats currency cleanly", () => {
    expect(formatMoney("1234.50")).toBe("$1,234.50");
  });

  it("safely handles division and throws on division by zero", () => {
    expect(divideMoney(100, 4).toString()).toBe("25");
    expect(() => divideMoney(100, 0)).toThrow("Division by zero");
  });
});

describe("src/lib/dates", () => {
  it("adds monthly intervals clamping month-ends correctly", () => {
    // Jan 31 + 1 month in non-leap year (e.g. 2025) clamps to Feb 28
    const jan31 = new Date(2025, 0, 31);
    const febEnd = addInterval(jan31, "MONTHLY", 1);
    expect(febEnd.getMonth()).toBe(1); // February
    expect(febEnd.getDate()).toBe(28);

    // Jan 31 + 1 month in leap year (2024) clamps to Feb 29
    const jan31Leap = new Date(2024, 0, 31);
    const febEndLeap = addInterval(jan31Leap, "MONTHLY", 1);
    expect(febEndLeap.getMonth()).toBe(1); // February
    expect(febEndLeap.getDate()).toBe(29);
  });

  it("adds yearly intervals clamping leap year Feb 29 correctly", () => {
    const leapDay = new Date(2024, 1, 29);
    const nextYear = addInterval(leapDay, "YEARLY", 1);
    expect(nextYear.getFullYear()).toBe(2025);
    expect(nextYear.getMonth()).toBe(1);
    expect(nextYear.getDate()).toBe(28);
  });

  it("generates deterministic cycle key", () => {
    const start = new Date(2026, 2, 1);
    const end = new Date(2026, 3, 1);
    const key = generateCycleKey("sub_test_1", start, end);
    expect(key).toBe("sub_test_1_2026-03-01_2026-04-01");
  });
});

