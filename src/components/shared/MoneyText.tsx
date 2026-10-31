import * as React from "react";
import Decimal from "decimal.js";
import { cn } from "@/lib/utils";

export interface MoneyTextProps {
  amount: number | string | Decimal | null | undefined;
  currency?: string;
  decimals?: number;
  className?: string;
  showPositiveSign?: boolean;
}

export function MoneyText({
  amount,
  currency = "$",
  decimals = 2,
  className,
  showPositiveSign = false,
}: MoneyTextProps) {
  let formatted = "0.00";
  let isNegative = false;
  let isPositive = false;

  try {
    if (amount !== null && amount !== undefined) {
      const dec = new Decimal(amount.toString());
      isNegative = dec.isNegative();
      isPositive = dec.isPositive() && !dec.isZero();
      formatted = dec.abs().toFixed(decimals);
    }
  } catch {
    formatted = "0.00";
  }

  // Format with thousand separators
  const parts = formatted.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formattedWithCommas = parts.join(".");

  return (
    <span
      className={cn(
        "font-mono tabular-nums tracking-tight font-medium text-foreground",
        isNegative && "text-rose-600 dark:text-rose-400",
        className
      )}
    >
      {isNegative ? "-" : showPositiveSign && isPositive ? "+" : ""}
      {currency}
      {formattedWithCommas}
    </span>
  );
}

