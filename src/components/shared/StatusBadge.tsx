import * as React from "react";
import { cn } from "@/lib/utils";

export type EntityStatus =
  | "draft"
  | "quotation"
  | "sent"
  | "confirmed"
  | "accepted"
  | "active"
  | "paused"
  | "closed"
  | "paid"
  | "overdue"
  | "cancelled"
  | "expired"
  | "pending"
  | "completed"
  | "failed"
  | "refunded"
  | string;

export interface StatusBadgeProps {
  status: EntityStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase();

  const getStyle = () => {
    switch (normalized) {
      case "active":
      case "paid":
      case "completed":
      case "accepted":
        return "bg-status-active text-status-activeFg border-status-activeFg/20";

      case "confirmed":
      case "sent":
        return "bg-status-confirmed text-status-confirmedFg border-status-confirmedFg/20";

      case "quotation":
        return "bg-status-quotation text-status-quotationFg border-status-quotationFg/20";

      case "paused":
      case "pending":
        return "bg-status-paused text-status-pausedFg border-status-pausedFg/20";

      case "overdue":
      case "failed":
        return "bg-status-overdue text-status-overdueFg border-status-overdueFg/20";

      case "draft":
        return "bg-status-draft text-status-draftFg border-status-draftFg/20";

      case "cancelled":
        return "bg-status-cancelled text-status-cancelledFg border-status-cancelledFg/20";

      case "expired":
      case "closed":
      case "refunded":
        return "bg-status-expired text-status-expiredFg border-status-expiredFg/20";

      default:
        return "bg-paper-3 text-muted-foreground border-rule";
    }
  };

  const getDisplayLabel = () => {
    // Format to clean sentence case (e.g., "Overdue", "Active", "In progress")
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium select-none",
        getStyle(),
        className
      )}
    >
      {getDisplayLabel()}
    </span>
  );
}

