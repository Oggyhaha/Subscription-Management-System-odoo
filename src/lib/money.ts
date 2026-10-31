import Decimal from "decimal.js";

// Explicit global rounding configuration: Banker-safe ROUND_HALF_UP for accounting
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -12,
  toExpPos: 28,
});

export const ROUNDING_MODE = Decimal.ROUND_HALF_UP;
export const MONEY_DECIMAL_PLACES = 2;

export type MoneyInput = string | number | Decimal | { toString(): string };

/**
 * Converts any money-like input to a clean Decimal instance
 */
export function toDecimal(value: MoneyInput): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  if (typeof value === "number" || typeof value === "string") {
    return new Decimal(value);
  }
  return new Decimal(value.toString());
}

/**
 * Rounds monetary value to 2 decimal places using ROUND_HALF_UP
 */
export function roundMoney(value: MoneyInput): Decimal {
  return toDecimal(value).toDecimalPlaces(MONEY_DECIMAL_PLACES, ROUNDING_MODE);
}

/**
 * Adds multiple monetary values and rounds result to 2 decimal places
 */
export function addMoney(...values: MoneyInput[]): Decimal {
  const sum = values.reduce<Decimal>((acc, val) => acc.plus(toDecimal(val)), new Decimal(0));
  return roundMoney(sum);
}

/**
 * Subtracts values from base and rounds result
 */
export function subtractMoney(base: MoneyInput, ...subtrahends: MoneyInput[]): Decimal {
  const result = subtrahends.reduce<Decimal>(
    (acc, val) => acc.minus(toDecimal(val)),
    toDecimal(base)
  );
  return roundMoney(result);
}

/**
 * Multiplies base by factor and rounds result to 2 decimal places
 */
export function multiplyMoney(base: MoneyInput, factor: MoneyInput): Decimal {
  return roundMoney(toDecimal(base).times(toDecimal(factor)));
}

/**
 * Calculates percentage discount or tax: base * (percent / 100)
 */
export function calculatePercentage(base: MoneyInput, percentage: MoneyInput): Decimal {
  const b = toDecimal(base);
  const p = toDecimal(percentage);
  return roundMoney(b.times(p).dividedBy(100));
}

/**
 * Divides numerator by denominator safely
 */
export function divideMoney(numerator: MoneyInput, denominator: MoneyInput): Decimal {
  const den = toDecimal(denominator);
  if (den.isZero()) {
    throw new Error("Division by zero in monetary calculation");
  }
  return roundMoney(toDecimal(numerator).dividedBy(den));
}

/**
 * Checks if monetary value is equal to zero
 */
export function isZero(value: MoneyInput): boolean {
  return toDecimal(value).isZero();
}

/**
 * Checks if monetary value is strictly greater than zero
 */
export function isPositive(value: MoneyInput): boolean {
  return toDecimal(value).isPositive() && !toDecimal(value).isZero();
}

/**
 * Checks if monetary value is strictly less than zero
 */
export function isNegative(value: MoneyInput): boolean {
  return toDecimal(value).isNegative();
}

/**
 * Formats Decimal or MoneyInput to localized currency string (e.g., "$1,234.56")
 */
export function formatMoney(value: MoneyInput, currency = "INR"): string {
  const decimal = roundMoney(value);
  const num = decimal.toNumber();
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: MONEY_DECIMAL_PLACES,
    maximumFractionDigits: MONEY_DECIMAL_PLACES,
  }).format(num);
}

