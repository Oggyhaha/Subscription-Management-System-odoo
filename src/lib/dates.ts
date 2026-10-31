import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  format,
  isAfter,
  isBefore,
  isEqual,
  parseISO,
  startOfDay,
  endOfDay,
  lastDayOfMonth,
  setDate,
} from "date-fns";

export type BillingInterval = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

/**
 * Adds a billing interval to a given date, correctly clamping month-end and leap-year boundaries.
 * E.g., Jan 31 + 1 month => Feb 28 (or Feb 29 in a leap year).
 */
export function addInterval(date: Date | string, interval: BillingInterval, count = 1): Date {
  const d = typeof date === "string" ? parseISO(date) : new Date(date.getTime());

  switch (interval) {
    case "DAILY":
      return addDays(d, count);

    case "WEEKLY":
      return addWeeks(d, count);

    case "MONTHLY": {
      // date-fns addMonths natively clamps to last day of target month if source day exceeds target days
      // E.g., Jan 31 + 1 month = Feb 28/29
      return addMonths(d, count);
    }

    case "YEARLY": {
      // date-fns addYears clamps Feb 29 to Feb 28 in non-leap years
      return addYears(d, count);
    }

    default:
      throw new Error(`Unsupported billing interval: ${interval}`);
  }
}

/**
 * Calculates cycle key for idempotency: e.g. "sub_123_2026-03-01_2026-04-01"
 */
export function generateCycleKey(subscriptionId: string, periodStart: Date, periodEnd: Date): string {
  const startStr = format(periodStart, "yyyy-MM-dd");
  const endStr = format(periodEnd, "yyyy-MM-dd");
  return `${subscriptionId}_${startStr}_${endStr}`;
}

/**
 * Formats a date into a standard user-friendly string
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM dd, yyyy");
}

/**
 * Formats a date and time for audit logs and timestamps
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM dd, yyyy HH:mm:ss");
}

/**
 * Checks if target date is overdue relative to today (ignoring hours)
 */
export function isOverdue(dueDate: Date | string): boolean {
  const due = startOfDay(typeof dueDate === "string" ? parseISO(dueDate) : dueDate);
  const today = startOfDay(new Date());
  return isBefore(due, today);
}

export {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  format,
  isAfter,
  isBefore,
  isEqual,
  parseISO,
  startOfDay,
  endOfDay,
  lastDayOfMonth,
};
